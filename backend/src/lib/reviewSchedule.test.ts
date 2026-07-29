import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STUDY_INTERVALS, nextDueAt } from "./reviewSchedule.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

test("each outcome adds its configured minutes to now, regardless of history", () => {
  assert.equal(nextDueAt("again", DEFAULT_STUDY_INTERVALS, NOW).getTime(), NOW.getTime());
  assert.equal(nextDueAt("hard", DEFAULT_STUDY_INTERVALS, NOW).getTime(), NOW.getTime() + 6 * 60 * 60_000);
  assert.equal(nextDueAt("good", DEFAULT_STUDY_INTERVALS, NOW).getTime(), NOW.getTime() + 12 * 60 * 60_000);
  assert.equal(nextDueAt("easy", DEFAULT_STUDY_INTERVALS, NOW).getTime(), NOW.getTime() + 24 * 60 * 60_000);
});

test("respects custom per-user intervals", () => {
  const custom = { again: 5, hard: 30, good: 90, easy: 2880 };
  assert.equal(nextDueAt("good", custom, NOW).getTime(), NOW.getTime() + 90 * 60_000);
  assert.equal(nextDueAt("easy", custom, NOW).getTime(), NOW.getTime() + 2880 * 60_000);
});
