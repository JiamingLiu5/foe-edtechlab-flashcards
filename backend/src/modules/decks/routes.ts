import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";
import type { DeckSummaryDTO } from "@flashcards/shared";

export async function listDeckSummariesForOwner(ownerId: string): Promise<DeckSummaryDTO[]> {
  const decks = await prisma.deck.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { cards: { select: { id: true } } },
  });

  const now = new Date();
  return Promise.all(
    decks.map(async (deck) => {
      const cardIds = deck.cards.map((c) => c.id);
      const [dueCount, forgottenCount] = cardIds.length
        ? await Promise.all([
            countDue(cardIds, ownerId, now),
            countForgotten(cardIds, ownerId),
          ])
        : [0, 0];

      return {
        id: deck.id,
        name: deck.name,
        cardCount: cardIds.length,
        dueCount,
        forgottenCount,
        createdAt: deck.createdAt.toISOString(),
      };
    })
  );
}

export async function deckRoutes(app: FastifyInstance) {
  app.get("/api/decks", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const summaries = await listDeckSummariesForOwner(user.userId);
    return reply.send({ decks: summaries });
  });

  app.post<{ Body: { name: string } }>("/api/decks", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const name = req.body?.name?.trim();
    if (!name) {
      return reply.code(400).send({ error: "invalid_name", message: "Deck name is required." });
    }

    const deck = await prisma.deck.create({ data: { name, ownerId: user.userId } });
    return reply.code(201).send({ deck });
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/api/decks/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const updated = await prisma.deck.update({
      where: { id: deck.id },
      data: { name: req.body?.name?.trim() || deck.name },
    });
    return reply.send({ deck: updated });
  });

  app.delete<{ Params: { id: string } }>("/api/decks/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    await prisma.deck.delete({ where: { id: deck.id } });
    return reply.send({ ok: true });
  });
}

async function countDue(cardIds: string[], userId: string, now: Date): Promise<number> {
  const latestReviews = await latestReviewPerCard(cardIds, userId);
  let due = 0;
  for (const cardId of cardIds) {
    const latest = latestReviews.get(cardId);
    if (!latest || latest.dueAt <= now) due += 1;
  }
  return due;
}

async function countForgotten(cardIds: string[], userId: string): Promise<number> {
  const latestReviews = await latestReviewPerCard(cardIds, userId);
  let forgotten = 0;
  for (const review of latestReviews.values()) {
    if (review.outcome === "again") forgotten += 1;
  }
  return forgotten;
}

async function latestReviewPerCard(cardIds: string[], userId: string) {
  const reviews = await prisma.review.findMany({
    where: { userId, cardId: { in: cardIds } },
    orderBy: { reviewedAt: "desc" },
  });
  const latest = new Map<string, (typeof reviews)[number]>();
  for (const review of reviews) {
    if (!latest.has(review.cardId)) latest.set(review.cardId, review);
  }
  return latest;
}
