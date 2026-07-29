import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";
import { nextSm2State } from "../../lib/sm2.js";
import type { ReviewOutcome } from "@flashcards/shared";

export async function studyRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/decks/:id/study/next", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cards = await prisma.card.findMany({ where: { deckId: deck.id }, orderBy: { createdAt: "asc" } });
    const now = new Date();
    const reviews = await prisma.review.findMany({
      where: { userId: user.userId, cardId: { in: cards.map((card) => card.id) } },
      orderBy: { reviewedAt: "desc" },
    });
    const latest = new Map<string, (typeof reviews)[number]>();
    for (const review of reviews) if (!latest.has(review.cardId)) latest.set(review.cardId, review);

    const due = cards
      .filter((card) => !latest.has(card.id) || latest.get(card.id)!.dueAt <= now)
      .sort((a, b) => {
        const aDue = latest.get(a.id)?.dueAt.getTime() ?? 0;
        const bDue = latest.get(b.id)?.dueAt.getTime() ?? 0;
        return aDue - bDue;
      });
    const card = due[0] ?? null;
    const current = card ? latest.get(card.id) : undefined;
    const previous = current
      ? { easeFactor: current.easeFactor, intervalDays: current.intervalDays, repetitions: current.repetitions }
      : null;
    const intervalPreviews = Object.fromEntries(
      (["again", "hard", "good", "easy"] as ReviewOutcome[]).map((outcome) => [
        outcome,
        nextSm2State(previous, outcome).intervalDays,
      ])
    );
    const nextDueAt = card
      ? null
      : [...latest.values()].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]?.dueAt.toISOString() ?? null;

    return reply.send({ card, isNew: !!card && !current, nextDueAt, intervalPreviews });
  });

  app.post<{ Body: { cardId: string; outcome: ReviewOutcome } }>("/api/reviews", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const { cardId, outcome } = req.body ?? ({} as { cardId: string; outcome: ReviewOutcome });
    if (!cardId || !outcome) {
      return reply.code(400).send({ error: "invalid_body", message: "cardId and outcome are required." });
    }

    const card = await prisma.card.findFirst({ where: { id: cardId }, include: { deck: true } });
    if (!card || card.deck.ownerId !== user.userId) {
      return reply.code(404).send({ error: "not_found", message: "Card not found." });
    }

    const previous = await prisma.review.findFirst({
      where: { userId: user.userId, cardId },
      orderBy: { reviewedAt: "desc" },
    });
    const next = nextSm2State(
      previous
        ? { easeFactor: previous.easeFactor, intervalDays: previous.intervalDays, repetitions: previous.repetitions }
        : null,
      outcome
    );

    const review = await prisma.review.create({
      data: {
        userId: user.userId,
        cardId,
        outcome,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt: next.dueAt,
      },
    });

    return reply.send({
      cardId,
      outcome,
      easeFactor: review.easeFactor,
      intervalDays: review.intervalDays,
      dueAt: review.dueAt.toISOString(),
    });
  });

  app.get<{ Params: { id: string }; Querystring: { mode?: string } }>("/api/decks/:id/quiz", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cards = await prisma.card.findMany({ where: { deckId: deck.id, includeInQuiz: true } });
    if (req.query.mode === "fill") {
      return reply.send({ questions: shuffle(cards).map((card) => ({ cardId: card.id, front: card.front, back: card.back })) });
    }
    if (cards.length < 4) {
      return reply.send({ questions: [] });
    }

    const questions = cards.map((card) => {
      const distractors = shuffle(cards.filter((c) => c.id !== card.id))
        .slice(0, 3)
        .map((c) => c.back);
      const options = shuffle([card.back, ...distractors]);
      return { cardId: card.id, front: card.front, options, answer: card.back };
    });

    return reply.send({ questions: shuffle(questions) });
  });
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
