import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { requireUser } from "../auth/plugin.js";
import { consumeDailyQuota, releaseDailyQuota } from "../../lib/quota.js";
import { gradeSelfCheckAnswer } from "../../lib/claude.js";
import { isRetryableAiError } from "../../lib/retry.js";

const AI_GRADING_TIMEOUT_MS = 40_000;

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_GRADING_TIMEOUT_MS);
    try {
      const result = await gradeSelfCheckAnswer(
        {
          question: card.front,
          referenceAnswer: card.back,
          studentAnswer: answer,
        },
        controller.signal
      );
      return reply.send(result);
    } catch (error) {
      await releaseDailyQuota(user.userId, "grading");
      if (controller.signal.aborted) {
        return reply.code(504).send({
          error: "ai_timeout",
          message: "AI grading is taking too long. Please try again.",
        });
      }
      if (isRetryableAiError(error)) {
        return reply.code(503).send({
          error: "ai_unavailable",
          message: "AI grading is temporarily unavailable. Please try again.",
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}
