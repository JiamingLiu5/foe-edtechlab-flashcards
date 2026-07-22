import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

export interface GeneratedCard {
  front: string;
  back: string;
  citation: string | null;
}

const GENERATION_SYSTEM_PROMPT = `You produce flashcards from OCR'd lecture-slide text for university students.

The text you're given was transcribed slide-by-slide, with "=== Slide N ===" markers separating each slide.

Rules:
- Every card MUST be grounded in the provided text. Include a short "citation" string naming the slide it came from (e.g. "Slide 14"), taken from the nearest marker above the fact.
- If you cannot find a grounded citation for a fact, do not produce a card for it.
- Match the voice and level of detail of the example cards from this deck, if any are given.
- Keep the front a concise question or prompt; keep the back concise (1-3 sentences, or a short list). Do not pad answers.
- Preserve mathematical notation using LaTeX, wrapped in $...$ for inline or $$...$$ for block formulae.
- Respond with ONLY a JSON array of objects: [{"front": string, "back": string, "citation": string}]. No prose, no markdown fences.`;

export async function generateCardsFromText(params: {
  slideText: string;
  filename: string;
  styleReferenceCards: { front: string; back: string }[];
}): Promise<GeneratedCard[]> {
  const styleBlock = params.styleReferenceCards.length
    ? `Existing cards in this deck, for style/voice reference:\n${params.styleReferenceCards
        .slice(0, 10)
        .map((c) => `Q: ${c.front}\nA: ${c.back}`)
        .join("\n\n")}`
    : "This deck has no existing cards yet — use a plain, direct academic tone.";

  const message = await anthropic.messages.create({
    model: env.anthropicModelGeneration,
    max_tokens: 4096,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${styleBlock}\n\nOCR'd slide text (file: ${params.filename}):\n\n${params.slideText}\n\nGenerate flashcards for the slides above.`,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  return parseGeneratedCards(text);
}

function parseGeneratedCards(text: string): GeneratedCard[] {
  const jsonText = extractJsonArray(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Claude did not return valid JSON for generated cards.");
  }
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of cards.");

  return parsed
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      front: String(c.front ?? "").trim(),
      back: String(c.back ?? "").trim(),
      citation: c.citation ? String(c.citation).trim() : null,
    }))
    .filter((c) => c.front && c.back);
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in Claude's response.");
  }
  return text.slice(start, end + 1);
}

const GRADING_SYSTEM_PROMPT = `You grade a student's typed answer against a flashcard's reference answer.

Respond with ONLY JSON: {"score": number (0-100), "feedback": string (1-2 sentences), "missing": string[] (key points the student omitted, empty array if none)}.
Be generous with phrasing/wording differences; be strict about factual correctness and completeness relative to the reference answer.`;

export async function gradeSelfCheckAnswer(params: {
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
}): Promise<{ score: number; feedback: string; missing: string[] }> {
  const message = await anthropic.messages.create({
    model: env.anthropicModelGrading,
    max_tokens: 512,
    system: GRADING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Question: ${params.question}\n\nReference answer: ${params.referenceAnswer}\n\nStudent's answer: ${params.studentAnswer}`,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude did not return a JSON grading result.");

  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    feedback: String(parsed.feedback ?? ""),
    missing: Array.isArray(parsed.missing) ? parsed.missing.map(String) : [],
  };
}
