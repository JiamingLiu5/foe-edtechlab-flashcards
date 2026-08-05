-- Existing learners keep the student experience after roles are split.
ALTER TYPE "UserRole" RENAME VALUE 'user' TO 'student';
ALTER TYPE "UserRole" ADD VALUE 'teacher';

CREATE TABLE "classrooms" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "joinCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classroom_members" (
  "classroomId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "classroom_members_pkey" PRIMARY KEY ("classroomId", "studentId")
);

CREATE TABLE "classroom_quizzes" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "classroom_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classroom_quiz_questions" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "options" TEXT[] NOT NULL,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
  CONSTRAINT "classroom_quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quiz_submissions" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "totalPoints" DOUBLE PRECISION NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "classrooms_joinCode_key" ON "classrooms"("joinCode");
CREATE INDEX "classrooms_teacherId_idx" ON "classrooms"("teacherId");
CREATE INDEX "classroom_members_studentId_idx" ON "classroom_members"("studentId");
CREATE INDEX "classroom_quizzes_classroomId_idx" ON "classroom_quizzes"("classroomId");
CREATE UNIQUE INDEX "classroom_quiz_questions_quizId_position_key" ON "classroom_quiz_questions"("quizId", "position");
CREATE UNIQUE INDEX "quiz_submissions_quizId_studentId_key" ON "quiz_submissions"("quizId", "studentId");
CREATE INDEX "quiz_submissions_studentId_idx" ON "quiz_submissions"("studentId");

ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_quizzes" ADD CONSTRAINT "classroom_quizzes_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classroom_quiz_questions" ADD CONSTRAINT "classroom_quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "classroom_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "classroom_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
