import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";

/**
 * Anki-compatible plain-text export (tab-separated Front/Back). Anki's
 * File > Import handles TSV natively — a real .apkg (SQLite) exporter is a
 * reasonable later upgrade but out of scope for this prototype.
 */
export async function exportRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/decks/:id/export/anki", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cards = await prisma.card.findMany({ where: { deckId: deck.id }, orderBy: { createdAt: "asc" } });

    const escape = (s: string) => s.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
    const tsv = cards.map((c) => `${escape(c.front)}\t${escape(c.back)}`).join("\n");

    reply
      .header("Content-Type", "text/tab-separated-values; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${deck.name.replace(/[^a-z0-9-_]+/gi, "_")}.txt"`)
      .send(tsv);
  });
}
