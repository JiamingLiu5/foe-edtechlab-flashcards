export interface GeneratedCard {
  front: string;
  back: string;
  citation: string | null;
}

export const GENERATION_SYSTEM_PROMPT = `You produce flashcards from source text (transcribed lecture slides, or the text of a webpage) for university students.

The text you're given is marked with "=== Slide N ===" or "=== Section: <heading> ===" markers separating each part of the source.

Rules:
- Write in the voice of a clear, supportive university teacher. Address the learner directly as "you" where appropriate; never refer to the learner in the third person (for example, "the student" or "they").
- Every card MUST be grounded in the provided text. Include a short "citation" string naming the slide or section it came from (e.g. "Slide 14" or "Section: Overview"), taken from the nearest marker above the fact.
- If you cannot find a grounded citation for a fact, do not produce a card for it.
- Match the voice and level of detail of the example cards from this deck, if any are given.
- Keep the front a concise question or prompt; keep the back concise (1-3 sentences, or a short list). Do not pad answers.
- Preserve mathematical notation using LaTeX, wrapped in $...$ for inline or $$...$$ for block formulae.
- Respond with ONLY a JSON array of objects: [{"front": string, "back": string, "citation": string}]. No prose, no markdown fences.`;

export const GRADING_SYSTEM_PROMPT = `You grade a student's typed answer against a flashcard's reference answer.

Respond with ONLY JSON: {"score": number (0-100), "feedback": string (1-2 sentences), "missing": string[] (key points the student omitted, empty array if none)}.
Write feedback as the learner's teacher: address them directly as "you" and never refer to them in the third person (for example, "the student" or "they"). Be encouraging but specific.
Be generous with phrasing/wording differences; be strict about factual correctness and completeness relative to the reference answer.
The reference answer may contain LaTeX. "feedback" and "missing" are shown as plain text, not rendered — describe any math in words instead of LaTeX (e.g. "the sum of" rather than "\\sum"), and never use backslashes.`;

export const REVIEW_SYSTEM_PROMPT = `You are a fact-checking and quality reviewer for a set of existing student flashcards.

You will be given a numbered list of flashcards (front = question/prompt, back = answer). You may also be given source material the deck was originally built from, marked with "=== Source: <name> ===" headers — when it's present, treat it as ground truth over your own general knowledge if the two conflict, but still use your own knowledge to catch errors the source material doesn't cover. When no source material is given, judge using standard academic knowledge alone.

Flag ONLY cards with a genuine problem:
- a factual error in the answer,
- an answer that's misleading, ambiguous, or internally contradictory,
- an answer that's badly out of date or wrong given standard academic consensus,
- an answer that contradicts the provided source material (when source material is given).

Do NOT flag a card just because it could be phrased more elegantly, more concisely, or differently in style — only flag real knowledge/correctness issues.

For each flagged card, provide: its "index" (matching the number in the list), a one-sentence "issue" explaining what's wrong, and a corrected "front"/"back" pair that fixes it while keeping the same topic and roughly the same length as the original.

Preserve mathematical notation using LaTeX, wrapped in $...$ for inline or $$...$$ for block formulae.

Respond with ONLY a JSON array: [{"index": number, "issue": string, "front": string, "back": string}]. Cards with no issue must NOT appear in the array. If no cards have issues, respond with [].`;

export function buildGenerationUserPrompt(params: {
  slideText: string;
  filename: string;
  cardLimit: number;
  styleReferenceCards: { front: string; back: string }[];
}): string {
  const styleBlock = params.styleReferenceCards.length
    ? `Existing cards in this deck, for style/voice reference:\n${params.styleReferenceCards
        .slice(0, 10)
        .map((c) => `Q: ${c.front}\nA: ${c.back}`)
        .join("\n\n")}`
    : "This deck has no existing cards yet — use a plain, direct academic tone.";

  return `${styleBlock}\n\nSource text (from: ${params.filename}):\n\n${params.slideText}\n\nGenerate at most ${params.cardLimit} flashcards for the source text above. Return fewer when the source does not support that many useful, distinct cards.`;
}

export function buildReviewUserPrompt(
  cards: { front: string; back: string }[],
  sources: { label: string; text: string }[] = []
): string {
  const sourceBlock = sources.length
    ? `Source material this deck was built from:\n\n${sources
        .map((s) => `=== Source: ${s.label} ===\n${s.text}`)
        .join("\n\n")}\n\n`
    : "";
  const list = cards.map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`).join("\n\n");
  return `${sourceBlock}Review these ${cards.length} flashcards:\n\n${list}`;
}

export function buildGradingUserPrompt(params: {
  question: string;
  referenceAnswer: string;
  studentAnswer: string;
}): string {
  return `Question: ${params.question}\n\nReference answer: ${params.referenceAnswer}\n\nStudent's answer: ${params.studentAnswer}`;
}

/**
 * Escapes backslashes the model left unescaped inside a JSON string — most often LaTeX
 * (e.g. "\sum", "\{") copied verbatim from a reference answer — that would otherwise make
 * JSON.parse throw. Valid JSON escapes (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX) are left alone.
 */
function sanitizeJsonBackslashes(raw: string): string {
  return raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function parseJsonSlice(text: string, start: number, end: number, providerName: string, what: string): unknown {
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(sanitizeJsonBackslashes(slice));
    } catch {
      throw new Error(`${providerName} did not return valid JSON for ${what}.`);
    }
  }
}

export function parseGeneratedCards(text: string, providerName: string): GeneratedCard[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON array found in ${providerName}'s response.`);
  }

  const parsed = parseJsonSlice(text, start, end, providerName, "generated cards");
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

export interface ReviewFlag {
  cardId: string;
  issue: string;
  front: string;
  back: string;
}

/** Maps the model's 1-indexed flags back onto the original card ids, dropping anything malformed or out of range. */
export function parseReviewFlags(
  text: string,
  providerName: string,
  cards: { id: string; front: string; back: string }[]
): ReviewFlag[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON array found in ${providerName}'s response.`);
  }

  const parsed = parseJsonSlice(text, start, end, providerName, "the review result");
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of flagged cards.");

  return parsed
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => {
      const index = Number(c.index);
      const card = Number.isInteger(index) ? cards[index - 1] : undefined;
      if (!card) return null;
      const front = String(c.front ?? "").trim();
      const back = String(c.back ?? "").trim();
      const issue = String(c.issue ?? "").trim();
      if (!front || !back || !issue) return null;
      return { cardId: card.id, issue, front, back };
    })
    .filter((f): f is ReviewFlag => f !== null);
}

export function parseGradingResult(
  text: string,
  providerName: string
): { score: number; feedback: string; missing: string[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`${providerName} did not return a JSON grading result.`);

  const parsed = parseJsonSlice(text, start, end, providerName, "the grading result") as Record<string, unknown>;
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    feedback: String(parsed.feedback ?? ""),
    missing: Array.isArray(parsed.missing) ? parsed.missing.map(String) : [],
  };
}
