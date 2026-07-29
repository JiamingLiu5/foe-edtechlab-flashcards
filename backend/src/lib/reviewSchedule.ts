import type { ReviewOutcome } from "@flashcards/shared";

export interface StudyIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export const DEFAULT_STUDY_INTERVALS: StudyIntervals = { again: 0, hard: 360, good: 720, easy: 1440 };

/** Fixed per-outcome delay (in minutes) until a card is due again — student-configurable, no ease factor or repetition growth. */
export function nextDueAt(outcome: ReviewOutcome, intervals: StudyIntervals, now = new Date()): Date {
  return new Date(now.getTime() + intervals[outcome] * 60_000);
}
