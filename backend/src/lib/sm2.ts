import type { ReviewOutcome } from "@flashcards/shared";

export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
}

export interface Sm2Result extends Sm2State {
  dueAt: Date;
}

const OUTCOME_QUALITY: Record<ReviewOutcome, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

const DEFAULT_STATE: Sm2State = { easeFactor: 2.5, intervalDays: 0 };
const MIN_EASE_FACTOR = 1.3;

/** SM-2 spaced-repetition scheduler, simplified to a 4-button (again/hard/good/easy) UI. */
export function nextSm2State(previous: Sm2State | null, outcome: ReviewOutcome): Sm2Result {
  const state = previous ?? DEFAULT_STATE;
  const quality = OUTCOME_QUALITY[outcome];

  let easeFactor = state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

  let intervalDays: number;
  if (outcome === "again") {
    intervalDays = 0; // due again today
  } else if (state.intervalDays === 0) {
    intervalDays = 1;
  } else if (state.intervalDays === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(state.intervalDays * easeFactor);
  }

  const dueAt = new Date();
  if (intervalDays === 0) {
    dueAt.setMinutes(dueAt.getMinutes() + 10); // "again" cards resurface soon, not tomorrow
  } else {
    dueAt.setDate(dueAt.getDate() + intervalDays);
  }

  return { easeFactor, intervalDays, dueAt };
}
