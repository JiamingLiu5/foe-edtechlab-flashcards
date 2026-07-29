-- Existing cards remain available in quizzes. Newly accepted AI cards start
-- excluded until their owner chooses otherwise in the acceptance prompt.
ALTER TABLE "cards" ADD COLUMN "includeInQuiz" BOOLEAN NOT NULL DEFAULT true;
