import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { requireUser } from "../auth/plugin.js";
import { consumeDailyQuota } from "../../lib/quota.js";
import { gradeSelfCheckAnswer } from "../../lib/claude.js";

export async function selfCheckRoutes(app: FastifyInstance) {
  app.post<{ Body: { cardId: string; answer: string } }>("/api/self-check/grade", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const { cardId, answer } = req.body ?? ({} as { cardId: string; answer: string });
    if (!cardId || !answer?.trim()) {
      return reply.code(400).send({ error: "invalid_body", message: "cardId and answer are required." });
    }

    const card = await prisma.card.findFirst({ where: { id: cardId }, include: { deck: true } });
    if (!card || card.deck.ownerId !== user.userId) {
      return reply.code(404).send({ error: "not_found", message: "Card not found." });
    }

    const allowed = await consumeDailyQuota(user.userId, "grading", env.dailyGradingQuota);
    if (!allowed) {
      return reply.code(429).send({
        error: "quota_exceeded",
        message: `Daily self-check grading limit (${env.dailyGradingQuota}) reached. Try again tomorrow.`,
      });
    }

    const result = await gradeSelfCheckAnswer({
      question: card.front,
      referenceAnswer: card.back,
      studentAnswer: answer,
    });

    return reply.send(result);
  });
}
