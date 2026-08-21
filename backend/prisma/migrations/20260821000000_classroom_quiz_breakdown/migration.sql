ALTER TABLE "classroom_quizzes"
  ADD COLUMN "allowStudentBreakdown" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "quiz_submission_answers" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selected" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "typedAnswer" TEXT,
  "pointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "quiz_submission_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_submission_answers_submissionId_questionId_key"
  ON "quiz_submission_answers"("submissionId", "questionId");
CREATE INDEX "quiz_submission_answers_questionId_idx"
  ON "quiz_submission_answers"("questionId");

ALTER TABLE "quiz_submission_answers"
  ADD CONSTRAINT "quiz_submission_answers_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "quiz_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quiz_submission_answers"
  ADD CONSTRAINT "quiz_submission_answers_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "classroom_quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
