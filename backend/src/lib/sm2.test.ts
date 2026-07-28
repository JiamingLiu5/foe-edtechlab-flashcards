import assert from "node:assert/strict";
import test from "node:test";
import { nextSm2State } from "./sm2.js";

const NOW = new Date("2026-07-27T12:00:00.000Z");

test("SM-2 uses the 1 day, 6 day, ease-factor progression", () => {
  const first = nextSm2State(null, "good", NOW);
  assert.equal(first.intervalDays, 1);
  assert.equal(first.repetitions, 1);

  const second = nextSm2State(first, "good", NOW);
  assert.equal(second.intervalDays, 6);
  assert.equal(second.repetitions, 2);

  const third = nextSm2State(second, "easy", NOW);
  assert.equal(third.intervalDays, 16);
  assert.equal(third.repetitions, 3);
});

test("a failed recall resets repetitions and never lowers ease below 1.3", () => {
  let state = { easeFactor: 1.3, intervalDays: 30, repetitions: 8 };
  const failed = nextSm2State(state, "again", NOW);
  assert.equal(failed.intervalDays, 1);
  assert.equal(failed.repetitions, 0);
  assert.equal(failed.easeFactor, 1.3);
  assert.equal(failed.dueAt.toISOString(), "2026-07-28T12:00:00.000Z");
});
