import { prisma } from "../db.js";
import { env } from "../env.js";
import { consumeDailyQuota, releaseDailyQuota } from "./quota.js";
import { generateDistractors } from "./claude.js";

const QUOTA_BUCKET = "mcq_distractors";

/**
 * Returns cached AI distractors for each card, generating and persisting them
 * (one batched AI call, one quota unit) for any card missing them. Cards left
 * out of the returned map — quota denied, or the AI call/parse failed — are
 * the caller's responsibility to pad with a fallback so quizzes stay usable.
 */
export async function ensureCardDistractors(
  userId: string,
  cards: { id: string; front: string; back: string; distractors: string[] }[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const missing = cards.filter((card) => card.distractors.length < 3);
  for (const card of cards) {
    if (card.distractors.length >= 3) result.set(card.id, card.distractors);
  }
  if (missing.length === 0) return result;

  const { allowed } = await consumeDailyQuota(userId, QUOTA_BUCKET, env.dailyDistractorQuota);
  if (!allowed) return result;

  try {
    const generated = await generateDistractors(missing.map((c) => ({ id: c.id, front: c.front, back: c.back })));
    const usable = generated.filter((g) => g.distractors.length > 0);
    await Promise.all(
      usable.map((g) => prisma.card.update({ where: { id: g.cardId }, data: { distractors: g.distractors } }))
    );
    for (const g of usable) result.set(g.cardId, g.distractors);
  } catch {
    // The AI call or its response parsing failed — release the reserved slot
    // (nothing was generated) and let the caller fall back for these cards.
    await releaseDailyQuota(userId, QUOTA_BUCKET);
  }

  return result;
}

/** Generates distractors for teacher-authored questions that are not cards in a deck. */
export async function generateQuestionDistractors(
  userId: string,
  questions: { id: string; front: string; back: string }[],
): Promise<Map<string, string[]>> {
  const { allowed, limit } = await consumeDailyQuota(userId, QUOTA_BUCKET, env.dailyDistractorQuota);
  if (!allowed) {
    throw Object.assign(new Error(`Daily MCQ distractor generation limit (${limit}) reached. Try again tomorrow.`), { code: "quota_exceeded" });
  }

  try {
    const generated = await generateDistractors(questions);
    const result = new Map(generated.map((item) => [item.cardId, item.distractors]));
    if (questions.some((question) => (result.get(question.id)?.length ?? 0) < 3)) {
      throw Object.assign(new Error("AI did not return three wrong options for every question."), { code: "incomplete_distractors" });
    }
    return result;
  } catch (error) {
    await releaseDailyQuota(userId, QUOTA_BUCKET);
    throw error;
  }
}
