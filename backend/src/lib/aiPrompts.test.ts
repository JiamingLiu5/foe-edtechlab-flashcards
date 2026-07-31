import assert from "node:assert/strict";
import test from "node:test";
import { parseCardDifficulties, parseGeneratedCards, parseGradingResult, parseReviewFlags } from "./aiPrompts.js";

test("parseGradingResult recovers from unescaped LaTeX backslashes in feedback", () => {
  // A model that echoes the reference answer's LaTeX (e.g. "\sum", "\{") without
  // JSON-escaping the backslash would otherwise make JSON.parse throw outright —
  // the raw string below is exactly that malformed shape (a literal, un-escaped "\s").
  const raw = `{"score": 40, "feedback": "You're missing the \\sum notation.", "missing": ["the summation"]}`;
  const result = parseGradingResult(raw, "Claude");
  assert.equal(result.score, 40);
  assert.match(result.feedback, /sum notation/);
  assert.deepEqual(result.missing, ["the summation"]);
});

test("parseGradingResult still parses well-formed JSON and clamps score", () => {
  const result = parseGradingResult(`{"score": 140, "feedback": "Great job.", "missing": []}`, "Claude");
  assert.equal(result.score, 100);
  assert.equal(result.feedback, "Great job.");
});

test("parseGradingResult throws a friendly error when nothing looks like JSON", () => {
  assert.throws(() => parseGradingResult("no json here", "Claude"), /did not return a JSON grading result/);
});

test("parseGeneratedCards recovers from unescaped backslashes and drops incomplete cards", () => {
  const raw = `[{"front": "What is \\alpha?", "back": "A constant.", "citation": "Slide 1", "difficulty": "easy"}, {"front": "", "back": "missing front"}]`;
  const cards = parseGeneratedCards(raw, "Claude");
  assert.equal(cards.length, 1);
  assert.match(cards[0].front, /alpha/);
  assert.equal(cards[0].difficulty, "easy");
});

test("parseReviewFlags maps 1-indexed flags back onto card ids", () => {
  const cards = [
    { id: "c1", front: "Q1", back: "A1" },
    { id: "c2", front: "Q2", back: "A2" },
  ];
  const raw = `[{"index": 2, "issue": "Wrong \\times sign", "front": "Q2 fixed", "back": "A2 fixed", "difficulty": "hard"}]`;
  const flags = parseReviewFlags(raw, "Claude", cards);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].cardId, "c2");
  assert.equal(flags[0].difficulty, "hard");
});

test("parseCardDifficulties keeps valid levels and safely defaults missing cards", () => {
  const cards = [
    { id: "c1", front: "Q1", back: "A1" },
    { id: "c2", front: "Q2", back: "A2" },
  ];
  const difficulties = parseCardDifficulties(`[{"index": 1, "difficulty": "easy"}]`, "Claude", cards);
  assert.deepEqual(difficulties, [
    { cardId: "c1", difficulty: "easy" },
    { cardId: "c2", difficulty: "medium" },
  ]);
});
