ALTER TABLE "classroom_quiz_questions"
  ADD COLUMN "correctAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "classroom_quiz_questions"
SET "correctAnswers" = ARRAY["answer"]
WHERE cardinality("correctAnswers") = 0;
