import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import * as gemini from "./gemini.js";
import { withRetry } from "./retry.js";
import {
  GENERATION_SYSTEM_PROMPT,
  DIFFICULTY_SYSTEM_PROMPT,
  DISTRACTOR_SYSTEM_PROMPT,
  GRADING_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildDifficultyUserPrompt,
  buildDistractorUserPrompt,
  buildGradingUserPrompt,
  buildReviewUserPrompt,
  parseGeneratedCards,
  parseCardDifficulties,
  parseDistractors,
  parseGradingResult,
  parseReviewFlags,
  type GeneratedCard,
  type CardDifficultyAssessment,
  type CardDistractors,
  type ReviewFlag,
} from "./aiPrompts.js";

export type { CardDifficultyAssessment, CardDistractors, GeneratedCard, ReviewFlag };

export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const usingGemini = !env.anthropicApiKey;
if (usingGemini) {
  console.warn("[ai] ANTHROPIC_API_KEY not set — falling back to Gemini for card generation and self-check grading.");
}

export async function generateCardsFromText(params: {
  slideText: string;
  filename: string;
  cardLimit: number;
  styleReferenceCards: { front: string; back: string }[];
}): Promise<GeneratedCard[]> {
  return withRetry(async () => {
    if (usingGemini) {
      return gemini.generateCardsFromText(params);
    }

    const message = await anthropic.messages.create({
      model: env.anthropicModelGeneration,
      max_tokens: 4096,
      system: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildGenerationUserPrompt(params) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    return parseGeneratedCards(text, "Claude");
  });
}

export async function reviewCards(
  cards: { id: string; front: string; back: string }[],
  sources: { label: string; text: string }[] = []
): Promise<ReviewFlag[]> {
  return withRetry(async () => {
    if (usingGemini) {
      return gemini.reviewCards(cards, sources);
    }

    const message = await anthropic.messages.create({
      model: env.anthropicModelGeneration,
      max_tokens: 4096,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildReviewUserPrompt(cards, sources) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    return parseReviewFlags(text, "Claude", cards);
  });
}

export async function assessCardDifficulties(
  cards: { id: string; front: string; back: string }[]
): Promise<CardDifficultyAssessment[]> {
  return withRetry(async () => {
    if (usingGemini) {
      return gemini.assessCardDifficulties(cards);
    }

    const message = await anthropic.messages.create({
      model: env.anthropicModelGeneration,
      max_tokens: 2048,
      system: DIFFICULTY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDifficultyUserPrompt(cards) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    return parseCardDifficulties(text, "Claude", cards);
  });
}

export async function generateDistractors(
  cards: { id: string; front: string; back: string }[]
): Promise<CardDistractors[]> {
  return withRetry(async () => {
    if (usingGemini) {
      return gemini.generateDistractors(cards);
    }

    const message = await anthropic.messages.create({
      model: env.anthropicModelGeneration,
      max_tokens: 4096,
      system: DISTRACTOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDistractorUserPrompt(cards) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    return parseDistractors(text, "Claude", cards);
  });
}

export async function gradeSelfCheckAnswer(params: {
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
}, signal?: AbortSignal): Promise<{ score: number; feedback: string; missing: string[] }> {
  return withRetry(async () => {
    if (usingGemini) {
      return gemini.gradeSelfCheckAnswer(params, signal);
    }

    const message = await anthropic.messages.create({
      model: env.anthropicModelGrading,
      max_tokens: 512,
      system: GRADING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildGradingUserPrompt(params) }],
    }, signal ? { signal } : undefined);

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n");

    return parseGradingResult(text, "Claude");
  });
}
