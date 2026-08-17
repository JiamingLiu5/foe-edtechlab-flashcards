ALTER TABLE "classroom_quizzes"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'mcq',
  ADD COLUMN "difficultyFilter" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "hardQuestionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timerMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "showPreview" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "classroom_quiz_questions"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'mcq';
