import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import * as gemini from "./gemini.js";
import {
  GENERATION_SYSTEM_PROMPT,
  GRADING_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildGradingUserPrompt,
  parseGeneratedCards,
  parseGradingResult,
  type GeneratedCard,
} from "./aiPrompts.js";

export type { GeneratedCard };

export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const usingGemini = !env.anthropicApiKey;
if (usingGemini) {
  console.warn("[ai] ANTHROPIC_API_KEY not set — falling back to Gemini for card generation and self-check grading.");
}

export async function generateCardsFromText(params: {
  slideText: string;
  filename: string;
  styleReferenceCards: { front: string; back: string }[];
}): Promise<GeneratedCard[]> {
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
}

export async function gradeSelfCheckAnswer(params: {
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
}): Promise<{ score: number; feedback: string; missing: string[] }> {
  if (usingGemini) {
    return gemini.gradeSelfCheckAnswer(params);
  }

  const message = await anthropic.messages.create({
    model: env.anthropicModelGrading,
    max_tokens: 512,
    system: GRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildGradingUserPrompt(params) }],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  return parseGradingResult(text, "Claude");
}
