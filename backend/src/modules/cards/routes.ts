import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";

async function assertDeckOwnership(deckId: string, userId: string) {
  return prisma.deck.findFirst({ where: { id: deckId, ownerId: userId } });
}

export async function cardRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/decks/:id/cards", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await assertDeckOwnership(req.params.id, user.userId);
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cards = await prisma.card.findMany({ where: { deckId: deck.id }, orderBy: { createdAt: "asc" } });
    return reply.send({ cards });
  });

  app.post<{ Params: { id: string }; Body: { front: string; back: string; tags?: string[] } | { cards: { front: string; back: string; tags?: string[] }[] } }>(
    "/api/decks/:id/cards",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;

      const deck = await assertDeckOwnership(req.params.id, user.userId);
      if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

      const body = req.body as any;
      const items: { front: string; back: string; tags?: string[] }[] = Array.isArray(body?.cards)
        ? body.cards
        : [{ front: body?.front, back: body?.back }];

      const cleaned = items
        .map((c) => ({
          front: (c.front ?? "").trim(),
          back: (c.back ?? "").trim(),
          tags: [...new Set((c.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
        }))
        .filter((c) => c.front && c.back);

      if (!cleaned.length) {
        return reply.code(400).send({ error: "invalid_cards", message: "Each card needs a front and back." });
      }

      const created = await prisma.$transaction(
        cleaned.map((c) =>
          prisma.card.create({ data: { deckId: deck.id, front: c.front, back: c.back, tags: c.tags, source: "manual" } })
        )
      );

      return reply.code(201).send({ cards: created });
    }
  );

  app.patch<{ Params: { id: string; cardId: string }; Body: { front?: string; back?: string; tags?: string[]; includeInQuiz?: boolean } }>(
    "/api/decks/:id/cards/:cardId",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;

      const deck = await assertDeckOwnership(req.params.id, user.userId);
      if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

      const card = await prisma.card.findFirst({ where: { id: req.params.cardId, deckId: deck.id } });
      if (!card) return reply.code(404).send({ error: "not_found", message: "Card not found." });

      const updated = await prisma.card.update({
        where: { id: card.id },
        data: {
          front: req.body?.front?.trim() || card.front,
          back: req.body?.back?.trim() || card.back,
          tags: req.body?.tags
            ? [...new Set(req.body.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
            : card.tags,
          includeInQuiz: typeof req.body?.includeInQuiz === "boolean" ? req.body.includeInQuiz : card.includeInQuiz,
        },
      });
      return reply.send({ card: updated });
    }
  );

  app.delete<{ Params: { id: string; cardId: string } }>("/api/decks/:id/cards/:cardId", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await assertDeckOwnership(req.params.id, user.userId);
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const card = await prisma.card.findFirst({ where: { id: req.params.cardId, deckId: deck.id } });
    if (!card) return reply.code(404).send({ error: "not_found", message: "Card not found." });

    await prisma.card.delete({ where: { id: card.id } });
    return reply.send({ ok: true });
  });
}
