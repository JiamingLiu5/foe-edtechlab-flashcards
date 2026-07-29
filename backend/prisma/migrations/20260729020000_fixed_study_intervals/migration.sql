-- Replaces adaptive SM-2 scheduling with fixed, student-configurable per-outcome
-- delays (defaults: again=0m, hard=6h, good=12h, easy=1d).

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "studyAgainMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "studyHardMinutes" INTEGER NOT NULL DEFAULT 360,
  ADD COLUMN "studyGoodMinutes" INTEGER NOT NULL DEFAULT 720,
  ADD COLUMN "studyEasyMinutes" INTEGER NOT NULL DEFAULT 1440;

-- AlterTable
ALTER TABLE "cards" ADD COLUMN "retired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reviews"
  DROP COLUMN "easeFactor",
  DROP COLUMN "intervalDays",
  DROP COLUMN "repetitions";
