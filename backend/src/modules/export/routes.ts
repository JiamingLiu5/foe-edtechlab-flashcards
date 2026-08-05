import type { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { ZipArchive } from "archiver";
import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
 ver integer not null, dty integer not null, usn integer not null, ls integer not null,
 conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
 usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
 flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
 mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
 ivl integer not null, factor integer not null, reps integer not null, lapses integer not null,
 left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
 ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn); CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_cards_nid on cards (nid); CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_usn on revlog (usn); CREATE INDEX ix_revlog_cid on revlog (cid);
`;

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function checksum(text: string): number {
  return Number.parseInt(createHash("sha1").update(text).digest("hex").slice(0, 8), 16);
}

async function zipApkg(collectionData: Buffer): Promise<Buffer> {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.pipe(output);
  archive.append(collectionData, { name: "collection.anki2" });
  archive.append("{}", { name: "media" });
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("error", reject);
  });
  await archive.finalize();
  return completed;
}

export async function exportRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/decks/:id/export/anki", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });
    const cards = await prisma.card.findMany({ where: { deckId: deck.id }, orderBy: { createdAt: "asc" } });

    const db = new Database(":memory:");
    try {
      db.exec(SCHEMA);
      const now = unixSeconds();
      const deckId = Date.now();
      const modelId = deckId + 1;
      const model = {
        [modelId]: {
          id: modelId, name: "Flashcards Basic", type: 0, mod: now, usn: -1, sortf: 0, did: deckId,
          tmpls: [{ name: "Card 1", ord: 0, qfmt: "{{Front}}", afmt: "{{FrontSide}}<hr id=answer>{{Back}}", did: null, bqfmt: "", bafmt: "" }],
          flds: [{ name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
            { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 }],
          css: ".card { font-family: Arial; font-size: 20px; text-align: center; color: black; background: white; }",
          latexPre: "", latexPost: "", latexsvg: false, req: [[0, "any", [0]]],
        },
      };
      const decks = {
        [deckId]: { id: deckId, name: deck.name, desc: "", mod: now, usn: -1, collapsed: false, dyn: 0,
          extendNew: 10, extendRev: 50, conf: 1 },
      };
      db.prepare("INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1, now, now, now * 1000, 11, 0, -1, 0, "{}", JSON.stringify(model), JSON.stringify(decks), "{}", "{}");
      const addNote = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      const addCard = db.prepare("INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      db.transaction(() => {
        cards.forEach((card, index) => {
          const noteId = deckId + index + 10;
          const cardId = deckId + cards.length + index + 10;
          const tags = card.tags.length ? ` ${card.tags.join(" ")} ` : "";
          addNote.run(noteId, createHash("sha1").update(card.id).digest("base64url").slice(0, 10), modelId,
            now, -1, tags, `${card.front}\u001f${card.back}`, card.front, checksum(card.front), 0, "");
          addCard.run(cardId, noteId, deckId, 0, now, -1, 0, 0, index + 1, 0, 0, 0, 0, 0, 0, 0, 0, "");
        });
      })();
      const collectionData = db.serialize();
      db.close();
      const apkg = await zipApkg(collectionData);
      const filename = deck.name.replace(/[^a-z0-9-_]+/gi, "_") || "deck";
      return reply
        .header("Content-Type", "application/vnd.anki")
        .header("Content-Disposition", `attachment; filename="${filename}.apkg"`)
        .send(apkg);
    } finally {
      if (db.open) db.close();
    }
  });
}
