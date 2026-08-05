import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireStudent, requireTeacher } from "../auth/plugin.js";
import type {
  ClassroomMemberDTO,
  ClassroomQuizDTO,
  ClassroomSummaryDTO,
  QuizSubmissionDTO,
} from "@flashcards/shared";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function newJoinCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function classroomSummary(classroom: {
  id: string; name: string; joinCode: string; createdAt: Date; _count: { members: number; quizzes: number };
}): ClassroomSummaryDTO {
  return {
    id: classroom.id,
    name: classroom.name,
    joinCode: classroom.joinCode,
    createdAt: classroom.createdAt.toISOString(),
    studentCount: classroom._count.members,
    quizCount: classroom._count.quizzes,
  };
}

function quizSummary(quiz: {
  id: string; classroomId: string; title: string; createdAt: Date; _count: { questions: number };
}, submission: { studentId: string; score: number; totalPoints: number; submittedAt: Date } | null = null, classroomName?: string): ClassroomQuizDTO {
  return {
    id: quiz.id,
    classroomId: quiz.classroomId,
    classroomName,
    title: quiz.title,
    createdAt: quiz.createdAt.toISOString(),
    questionCount: quiz._count.questions,
    submission: submission ? {
      studentId: submission.studentId,
      score: submission.score,
      totalPoints: submission.totalPoints,
      submittedAt: submission.submittedAt.toISOString(),
    } : null,
  };
}

function submissionSummary(submission: {
  studentId: string; score: number; totalPoints: number; submittedAt: Date;
  student: { email: string; displayName: string | null };
}): QuizSubmissionDTO {
  return {
    studentId: submission.studentId,
    studentEmail: submission.student.email,
    studentDisplayName: submission.student.displayName,
    score: submission.score,
    totalPoints: submission.totalPoints,
    submittedAt: submission.submittedAt.toISOString(),
  };
}

export async function classroomRoutes(app: FastifyInstance) {
  app.get("/api/classrooms", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;

    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: teacher.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, quizzes: true } } },
    });
    return reply.send({ classrooms: classrooms.map(classroomSummary) });
  });

  app.post<{ Body: { name?: string } }>("/api/classrooms", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const name = req.body?.name?.trim();
    if (!name) return reply.code(400).send({ error: "invalid_name", message: "A classroom name is required." });

    // An eight-character code has ample space; retrying also makes the uniqueness guarantee explicit.
    let classroom: Awaited<ReturnType<typeof prisma.classroom.create>> | null = null;
    for (let attempt = 0; attempt < 3 && !classroom; attempt += 1) {
      try {
        classroom = await prisma.classroom.create({ data: { teacherId: teacher.userId, name, joinCode: newJoinCode() } });
      } catch (error: any) {
        if (error?.code !== "P2002") throw error;
      }
    }
    if (!classroom) return reply.code(503).send({ error: "code_unavailable", message: "Couldn't create a join code. Please try again." });

    return reply.code(201).send({ classroom: { ...classroomSummary({ ...classroom, _count: { members: 0, quizzes: 0 } }) } });
  });

  app.get<{ Params: { id: string } }>("/api/classrooms/:id", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const classroom = await prisma.classroom.findFirst({
      where: { id: req.params.id, teacherId: teacher.userId },
      include: {
        _count: { select: { members: true, quizzes: true } },
        members: { orderBy: { joinedAt: "asc" }, include: { student: { select: { id: true, email: true, displayName: true } } } },
        quizzes: { orderBy: { createdAt: "desc" }, include: { _count: { select: { questions: true } } } },
      },
    });
    if (!classroom) return reply.code(404).send({ error: "not_found", message: "Classroom not found." });

    const members: ClassroomMemberDTO[] = classroom.members.map((member) => ({
      id: member.student.id, email: member.student.email, displayName: member.student.displayName, joinedAt: member.joinedAt.toISOString(),
    }));
    return reply.send({
      classroom: classroomSummary(classroom), members,
      quizzes: classroom.quizzes.map((quiz) => quizSummary(quiz)),
    });
  });

  app.post<{ Params: { id: string }; Body: { deckId?: string; title?: string; questionCount?: number } }>("/api/classrooms/:id/quizzes", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const classroom = await prisma.classroom.findFirst({ where: { id: req.params.id, teacherId: teacher.userId } });
    if (!classroom) return reply.code(404).send({ error: "not_found", message: "Classroom not found." });

    const deckId = req.body?.deckId;
    const count = Math.floor(Number(req.body?.questionCount));
    if (!deckId || !Number.isInteger(count) || count < 1 || count > 100) {
      return reply.code(400).send({ error: "invalid_quiz", message: "Choose a deck and between 1 and 100 questions." });
    }
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, ownerId: teacher.userId },
      // Classroom assignments use the teacher's whole deck. The student's personal
      // practice preference (`includeInQuiz`) should not silently omit taught material.
      include: { cards: true },
    });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Quiz deck not found." });
    if (deck.cards.length < 4) {
      return reply.code(400).send({ error: "not_enough_cards", message: "A classroom quiz needs at least four cards for answer options." });
    }
    if (count > deck.cards.length) {
      return reply.code(400).send({ error: "not_enough_cards", message: `Only ${deck.cards.length} cards are available in this deck.` });
    }

    const selected = shuffle(deck.cards).slice(0, count);
    const title = req.body?.title?.trim() || `${deck.name} quiz`;
    const quiz = await prisma.classroomQuiz.create({
      data: {
        classroomId: classroom.id, title,
        questions: {
          create: selected.map((card, position) => ({
            position, prompt: card.front, answer: card.back,
            options: shuffle([card.back, ...shuffle(deck.cards.filter((other) => other.id !== card.id)).slice(0, 3).map((other) => other.back)]),
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    return reply.code(201).send({ quiz: quizSummary(quiz) });
  });

  app.get<{ Params: { id: string; quizId: string } }>("/api/classrooms/:id/quizzes/:quizId/scores", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const quiz = await prisma.classroomQuiz.findFirst({
      where: { id: req.params.quizId, classroomId: req.params.id, classroom: { teacherId: teacher.userId } },
      include: {
        _count: { select: { questions: true } },
        submissions: { include: { student: { select: { email: true, displayName: true } } }, orderBy: { submittedAt: "desc" } },
      },
    });
    if (!quiz) return reply.code(404).send({ error: "not_found", message: "Quiz not found." });
    return reply.send({ quiz: quizSummary(quiz), scores: quiz.submissions.map(submissionSummary) });
  });

  app.post<{ Body: { joinCode?: string } }>("/api/classrooms/join", async (req, reply) => {
    const student = requireStudent(req, reply);
    if (!student) return;
    const joinCode = req.body?.joinCode?.trim().toUpperCase();
    if (!joinCode) return reply.code(400).send({ error: "invalid_code", message: "Enter a classroom code." });
    const classroom = await prisma.classroom.findUnique({
      where: { joinCode }, include: { _count: { select: { members: true, quizzes: true } } },
    });
    if (!classroom) return reply.code(404).send({ error: "not_found", message: "No classroom has that code." });
    await prisma.classroomMember.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.userId } },
      update: {}, create: { classroomId: classroom.id, studentId: student.userId },
    });
    return reply.send({ classroom: classroomSummary(classroom) });
  });

  app.get("/api/classroom-quizzes", async (req, reply) => {
    const student = requireStudent(req, reply);
    if (!student) return;
    const quizzes = await prisma.classroomQuiz.findMany({
      where: { classroom: { members: { some: { studentId: student.userId } } } },
      orderBy: { createdAt: "desc" },
      include: {
        classroom: { select: { name: true } }, _count: { select: { questions: true } },
        submissions: { where: { studentId: student.userId }, select: { studentId: true, score: true, totalPoints: true, submittedAt: true } },
      },
    });
    return reply.send({ quizzes: quizzes.map((quiz) => quizSummary(quiz, quiz.submissions[0] ?? null, quiz.classroom.name)) });
  });

  app.get<{ Params: { id: string } }>("/api/classroom-quizzes/:id", async (req, reply) => {
    const student = requireStudent(req, reply);
    if (!student) return;
    const quiz = await prisma.classroomQuiz.findFirst({
      where: { id: req.params.id, classroom: { members: { some: { studentId: student.userId } } } },
      include: {
        classroom: { select: { name: true } }, questions: { orderBy: { position: "asc" } }, _count: { select: { questions: true } },
        submissions: { where: { studentId: student.userId }, select: { studentId: true, score: true, totalPoints: true, submittedAt: true } },
      },
    });
    if (!quiz) return reply.code(404).send({ error: "not_found", message: "Quiz not found." });
    return reply.send({
      quiz: quizSummary(quiz, null, quiz.classroom.name),
      questions: quiz.questions.map((question) => ({ id: question.id, prompt: question.prompt, options: question.options, points: question.points })),
      submission: quiz.submissions[0]
        ? { ...quiz.submissions[0], submittedAt: quiz.submissions[0].submittedAt.toISOString() }
        : null,
    });
  });

  app.post<{ Params: { id: string }; Body: { answers?: { questionId?: string; selected?: string | null }[] } }>("/api/classroom-quizzes/:id/submit", async (req, reply) => {
    const student = requireStudent(req, reply);
    if (!student) return;
    const quiz = await prisma.classroomQuiz.findFirst({
      where: { id: req.params.id, classroom: { members: { some: { studentId: student.userId } } } },
      include: { questions: true },
    });
    if (!quiz) return reply.code(404).send({ error: "not_found", message: "Quiz not found." });
    const existing = await prisma.quizSubmission.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId: student.userId } } });
    if (existing) return reply.code(409).send({ error: "already_submitted", message: "You have already submitted this quiz." });

    const selections = new Map((req.body?.answers ?? []).map((answer) => [answer.questionId, answer.selected]));
    const totalPoints = quiz.questions.reduce((total, question) => total + question.points, 0);
    const score = quiz.questions.reduce((total, question) => total + (selections.get(question.id) === question.answer ? question.points : 0), 0);
    try {
      const submission = await prisma.quizSubmission.create({ data: { quizId: quiz.id, studentId: student.userId, score, totalPoints } });
      return reply.code(201).send({ submission: { studentId: submission.studentId, score: submission.score, totalPoints: submission.totalPoints, submittedAt: submission.submittedAt.toISOString() } });
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "already_submitted", message: "You have already submitted this quiz." });
      throw error;
    }
  });
}
