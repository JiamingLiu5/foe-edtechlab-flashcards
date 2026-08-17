import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { gradeSelfCheckAnswer } from "../../lib/claude.js";
import { requireStudent, requireTeacher } from "../auth/plugin.js";
import { ensureCardDistractors, generateQuestionDistractors } from "../../lib/distractors.js";
import { consumeDailyQuota, releaseDailyQuota } from "../../lib/quota.js";
import { isRetryableAiError } from "../../lib/retry.js";
import type {
  ClassroomQuizQuestionDraftDTO,
  ClassroomMemberDTO,
  ClassroomQuizDTO,
  ClassroomSummaryDTO,
  QuizConfiguration,
  QuizDifficultyFilter,
  QuizMode,
  QuizQuestionKind,
  QuizSubmissionDTO,
} from "@flashcards/shared";

type ClassroomQuizCreateBody = Partial<QuizConfiguration> & {
  deckId?: string;
  title?: string;
  questions?: ClassroomQuizQuestionDraftDTO[];
};

type McqOptionsBody = {
  questions?: { id?: string; prompt?: string; answer?: string; answers?: string[] }[];
};

const QUIZ_MODES: QuizMode[] = ["mcq", "fill", "mix"];
const QUIZ_DIFFICULTIES: QuizDifficultyFilter[] = ["all", "easy", "medium", "hard"];
const QUIZ_KINDS: QuizQuestionKind[] = ["mcq", "fill"];
const AI_GRADING_TIMEOUT_MS = 40_000;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Tops up AI distractors with other cards' answers when the AI didn't supply (or wasn't asked for) enough. */
function topUpDistractors(distractors: string[], card: { id: string; back: string }, allCards: { id: string; back: string }[]): string[] {
  if (distractors.length >= 3) return distractors.slice(0, 3);
  const exclude = new Set([card.back, ...distractors]);
  const filler = shuffle(allCards.filter((c) => c.id !== card.id && !exclude.has(c.back))).map((c) => c.back);
  return [...distractors, ...filler].slice(0, 3);
}

function newJoinCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function isQuizMode(value: unknown): value is QuizMode {
  return typeof value === "string" && QUIZ_MODES.includes(value as QuizMode);
}

function isQuizDifficulty(value: unknown): value is QuizDifficultyFilter {
  return typeof value === "string" && QUIZ_DIFFICULTIES.includes(value as QuizDifficultyFilter);
}

function isQuizKind(value: unknown): value is QuizQuestionKind {
  return typeof value === "string" && QUIZ_KINDS.includes(value as QuizQuestionKind);
}

function correctAnswersFor(question: { answer: string; correctAnswers: string[] }): string[] {
  return question.correctAnswers.length > 0 ? question.correctAnswers : [question.answer];
}

function answerSetsMatch(selected: string[], correct: string[]): boolean {
  const selectedSet = new Set(selected);
  const correctSet = new Set(correct);
  return selectedSet.size === correctSet.size && [...correctSet].every((answer) => selectedSet.has(answer));
}

function normaliseAnswers(answers: string[]): string[] {
  const seen = new Set<string>();
  return answers
    .map((answer) => answer.trim())
    .filter((answer) => {
      const key = answer.toLowerCase();
      if (!answer || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function chooseCards<T extends { id: string; difficulty: string }>(
  cards: T[],
  count: number,
  difficultyFilter: QuizDifficultyFilter,
  hardQuestionCount: number
): T[] {
  const hard = shuffle(cards.filter((card) => card.difficulty === "hard")).slice(0, hardQuestionCount);
  const selectedIds = new Set(hard.map((card) => card.id));
  const remaining = cards.filter((card) => !selectedIds.has(card.id));
  const matching = difficultyFilter === "all"
    ? remaining
    : remaining.filter((card) => card.difficulty === difficultyFilter);
  return shuffle([...hard, ...shuffle(matching).slice(0, count - hard.length)]);
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
  id: string; classroomId: string; title: string; createdAt: Date; mode: string; difficultyFilter: string;
  hardQuestionCount: number; timerMinutes: number; showPreview: boolean; _count: { questions: number };
}, submission: { studentId: string; score: number; totalPoints: number; submittedAt: Date } | null = null, classroomName?: string): ClassroomQuizDTO {
  return {
    id: quiz.id,
    classroomId: quiz.classroomId,
    classroomName,
    title: quiz.title,
    createdAt: quiz.createdAt.toISOString(),
    questionCount: quiz._count.questions,
    mode: isQuizMode(quiz.mode) ? quiz.mode : "mcq",
    difficultyFilter: isQuizDifficulty(quiz.difficultyFilter) ? quiz.difficultyFilter : "all",
    hardQuestionCount: quiz.hardQuestionCount,
    timerMinutes: quiz.timerMinutes,
    showPreview: quiz.showPreview,
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

async function gradeClassroomFillAnswer(userId: string, question: string, referenceAnswer: string, studentAnswer: string): Promise<number> {
  const quota = await consumeDailyQuota(userId, "grading", env.dailyGradingQuota);
  if (!quota.allowed) {
    throw Object.assign(new Error(`Daily self-check grading limit (${quota.limit}) reached. Try again tomorrow.`), { code: "quota_exceeded" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_GRADING_TIMEOUT_MS);
  try {
    const result = await gradeSelfCheckAnswer({ question, referenceAnswer, studentAnswer }, controller.signal);
    return Math.max(0, Math.min(100, result.score));
  } catch (error) {
    await releaseDailyQuota(userId, "grading");
    if (controller.signal.aborted) throw Object.assign(new Error("AI grading timed out."), { code: "ai_timeout" });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

  app.post<{ Params: { id: string }; Body: McqOptionsBody }>("/api/classrooms/:id/mcq-options", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const classroom = await prisma.classroom.findFirst({ where: { id: req.params.id, teacherId: teacher.userId } });
    if (!classroom) return reply.code(404).send({ error: "not_found", message: "Classroom not found." });

    const draftQuestions = req.body?.questions ?? [];
    if (!Array.isArray(draftQuestions) || draftQuestions.length < 1 || draftQuestions.length > 100) {
      return reply.code(400).send({ error: "invalid_questions", message: "Add between 1 and 100 MCQ questions." });
    }
    const questions = draftQuestions.map((question, index) => {
      const correctAnswers = normaliseAnswers(question.answers?.length ? question.answers : question.answer ? [question.answer] : []);
      return {
        id: question.id?.trim() || String(index),
        front: question.prompt?.trim() ?? "",
        back: correctAnswers[0] ?? "",
        correctAnswers,
      };
    });
    if (questions.some((question) => !question.front || question.correctAnswers.length === 0)) {
      return reply.code(400).send({ error: "invalid_questions", message: "Every MCQ needs a question and at least one correct answer." });
    }

    try {
      const distractors = await generateQuestionDistractors(teacher.userId, questions);
      return reply.send({
        questions: questions.map((question) => ({
          id: question.id,
          prompt: question.front,
          answer: question.back,
          correctAnswers: question.correctAnswers,
          options: shuffle([...question.correctAnswers, ...(distractors.get(question.id) ?? [])]),
        })),
      });
    } catch (error: any) {
      if (error?.code === "quota_exceeded") return reply.code(429).send({ error: "quota_exceeded", message: error.message });
      if (error?.code === "incomplete_distractors") return reply.code(503).send({ error: "ai_incomplete", message: "AI could not create three wrong options for every question. Please try again." });
      if (isRetryableAiError(error)) return reply.code(503).send({ error: "ai_unavailable", message: "AI distractor generation is temporarily unavailable. Please try again." });
      throw error;
    }
  });

  app.post<{ Params: { id: string }; Body: ClassroomQuizCreateBody }>("/api/classrooms/:id/quizzes", async (req, reply) => {
    const teacher = requireTeacher(req, reply);
    if (!teacher) return;
    const classroom = await prisma.classroom.findFirst({ where: { id: req.params.id, teacherId: teacher.userId } });
    if (!classroom) return reply.code(404).send({ error: "not_found", message: "Classroom not found." });

    const body = req.body ?? {};
    const deckId = body.deckId;
    const count = Math.floor(Number(body.questionCount));
    const mode = body.mode ?? "mcq";
    const difficultyFilter = body.difficultyFilter ?? "all";
    const hardQuestionCount = Math.floor(Number(body.hardQuestionCount ?? 0));
    const timerMinutes = Math.floor(Number(body.timerMinutes ?? 0));
    const showPreview = body.showPreview ?? true;
    if (!deckId || !Number.isInteger(count) || count < 1 || count > 100
      || !isQuizMode(mode) || !isQuizDifficulty(difficultyFilter)
      || !Number.isInteger(hardQuestionCount) || hardQuestionCount < 0 || hardQuestionCount > count
      || !Number.isInteger(timerMinutes) || timerMinutes < 0 || timerMinutes > 24 * 60
      || typeof showPreview !== "boolean") {
      return reply.code(400).send({ error: "invalid_quiz", message: "Choose a valid quiz format, question count, difficulty, hard-question count, and timer." });
    }
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, ownerId: teacher.userId },
      include: { cards: true },
    });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Quiz deck not found." });

    // Teacher assignments follow the same quiz-eligible pool as self-study quizzes.
    const eligibleCards = deck.cards.filter((card) => card.includeInQuiz);
    const hasCustomQuestions = Array.isArray(body.questions)
      && body.questions.length > 0
      && body.questions.every((question) => !question.cardId);
    if ((mode === "mcq" || mode === "mix") && eligibleCards.length < 4 && !hasCustomQuestions) {
      return reply.code(400).send({ error: "not_enough_cards", message: "Multiple-choice quizzes need at least four quiz-eligible cards for answer options." });
    }

    if (!Array.isArray(body.questions) && count > eligibleCards.length) {
      return reply.code(400).send({ error: "not_enough_cards", message: `Only ${eligibleCards.length} quiz-eligible cards match this deck.` });
    }

    type PreparedQuestion = {
      card: (typeof deck.cards)[number] | null;
      kind: QuizQuestionKind;
      prompt: string;
      answer: string;
      correctAnswers: string[];
      points: number;
      options: string[];
    };

    let prepared: PreparedQuestion[];
    if (hasCustomQuestions) {
      if (mode !== "mcq" || difficultyFilter !== "all" || hardQuestionCount !== 0
        || body.questions!.length !== count || body.questions!.some((question) => {
          const prompt = question.prompt?.trim() ?? "";
          const correctAnswers = normaliseAnswers(question.correctAnswers?.length ? question.correctAnswers : question.answer ? [question.answer] : []);
          const options = question.options ?? [];
          return !prompt || correctAnswers.length === 0 || question.kind !== "mcq"
            || options.length < correctAnswers.length + 3 || correctAnswers.some((answer) => !options.includes(answer))
            || !Number.isFinite(Number(question.points)) || Number(question.points) < 0;
        })) {
        return reply.code(400).send({ error: "invalid_quiz", message: "Custom MCQs must include a question, at least one correct answer, three wrong options, and no deck difficulty filter." });
      }
      prepared = body.questions!.map((question) => ({
        card: null,
        kind: "mcq",
        prompt: question.prompt!.trim(),
        correctAnswers: normaliseAnswers(question.correctAnswers?.length ? question.correctAnswers : [question.answer!]),
        answer: normaliseAnswers(question.correctAnswers?.length ? question.correctAnswers : [question.answer!])[0],
        points: Number(question.points),
        options: [...(question.options ?? [])],
      }));
    } else if (Array.isArray(body.questions)) {
      if (body.questions.length !== count || body.questions.length < 1) {
        return reply.code(400).send({ error: "invalid_quiz", message: "The prepared questions do not match the requested question count." });
      }

      const cardsById = new Map(eligibleCards.map((card) => [card.id, card]));
      const seen = new Set<string>();
      const invalid = body.questions.some((question) => {
        const cardId = question.cardId;
        if (!cardId) return true;
        const card = cardsById.get(cardId);
        const kindAllowed = mode === "mix" ? isQuizKind(question.kind) : question.kind === mode;
        const points = Number(question.points);
        const options = question.options ?? [];
        const optionsAllowed = question.kind === "fill"
          ? options.length === 0
          : options.length >= 2 && options.includes(card?.back ?? "");
        if (!card || seen.has(cardId) || !kindAllowed || !Number.isFinite(points) || points < 0 || !optionsAllowed) return true;
        seen.add(cardId);
        return false;
      });
      if (invalid) {
        return reply.code(400).send({ error: "invalid_quiz", message: "The prepared quiz questions are invalid." });
      }

      const selectedCards = body.questions.map((question) => cardsById.get(question.cardId!)!);
      const hardSelected = selectedCards.filter((card) => card.difficulty === "hard").length;
      const matchingSelected = difficultyFilter === "all"
        ? selectedCards
        : selectedCards.filter((card) => card.difficulty === difficultyFilter);
      if (hardSelected < hardQuestionCount || matchingSelected.length < count - hardQuestionCount) {
        return reply.code(400).send({ error: "invalid_quiz", message: "The prepared questions do not match the selected difficulty settings." });
      }

      prepared = body.questions.map((question) => ({
        card: cardsById.get(question.cardId!)!,
        kind: question.kind,
        prompt: cardsById.get(question.cardId!)!.front,
        answer: cardsById.get(question.cardId!)!.back,
        correctAnswers: [cardsById.get(question.cardId!)!.back],
        points: Number(question.points),
        options: question.kind === "fill" ? [] : [...(question.options ?? [])],
      }));
    } else {
      const selected = chooseCards(eligibleCards, count, difficultyFilter, hardQuestionCount);
      if (selected.length < count) {
        return reply.code(400).send({ error: "not_enough_cards", message: `Only ${selected.length} quiz-eligible cards match this setup.` });
      }
      prepared = selected.map((card) => ({
        card,
        kind: mode === "mix" ? (Math.random() < 0.5 ? "mcq" : "fill") : mode,
        prompt: card.front,
        answer: card.back,
        correctAnswers: [card.back],
        points: 1,
        options: [],
      }));
    }

    const title = req.body?.title?.trim() || `${deck.name} quiz`;
    const needsDistractors = prepared.some((question) => question.kind === "mcq" && question.card && question.options.length < 4);
    const aiDistractors = needsDistractors ? await ensureCardDistractors(teacher.userId, deck.cards) : new Map<string, string[]>();
    const quiz = await prisma.classroomQuiz.create({
      data: {
        classroomId: classroom.id,
        title,
        mode,
        difficultyFilter,
        hardQuestionCount,
        timerMinutes,
        showPreview,
        questions: {
          create: prepared.map((question, position) => ({
            position,
            kind: question.kind,
            prompt: question.prompt,
            answer: question.answer,
            correctAnswers: question.correctAnswers,
            points: question.points,
            options: question.kind === "fill"
              ? []
              : shuffle(question.options.length >= question.correctAnswers.length + 3
                ? question.options.slice(0, question.correctAnswers.length + 3)
                : question.card
                  ? [question.answer, ...topUpDistractors(aiDistractors.get(question.card.id) ?? [], question.card, deck.cards)]
                  : question.options),
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
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        points: question.points,
        kind: isQuizKind(question.kind) ? question.kind : "mcq",
        multiSelect: correctAnswersFor(question).length > 1,
      })),
      submission: quiz.submissions[0]
        ? { ...quiz.submissions[0], submittedAt: quiz.submissions[0].submittedAt.toISOString() }
        : null,
    });
  });

  app.post<{ Params: { id: string }; Body: { answers?: { questionId?: string; selected?: string | string[] | null; typedAnswer?: string | null }[] } }>("/api/classroom-quizzes/:id/submit", async (req, reply) => {
    const student = requireStudent(req, reply);
    if (!student) return;
    const quiz = await prisma.classroomQuiz.findFirst({
      where: { id: req.params.id, classroom: { members: { some: { studentId: student.userId } } } },
      include: { questions: true },
    });
    if (!quiz) return reply.code(404).send({ error: "not_found", message: "Quiz not found." });
    const existing = await prisma.quizSubmission.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId: student.userId } } });
    if (existing) return reply.code(409).send({ error: "already_submitted", message: "You have already submitted this quiz." });

    const answers = new Map((req.body?.answers ?? []).map((answer) => [answer.questionId, answer]));
    const totalPoints = quiz.questions.reduce((total, question) => total + question.points, 0);
    let score = 0;
    try {
      for (const question of quiz.questions) {
        const answer = answers.get(question.id);
        if (question.kind === "fill") {
          const typedAnswer = answer?.typedAnswer?.trim();
          if (!typedAnswer) continue;
          score += question.points * (await gradeClassroomFillAnswer(student.userId, question.prompt, question.answer, typedAnswer) / 100);
        } else {
          const selected = Array.isArray(answer?.selected)
            ? answer.selected
            : answer?.selected
              ? [answer.selected]
              : [];
          if (answerSetsMatch(selected, correctAnswersFor(question))) score += question.points;
        }
      }
    } catch (error: any) {
      if (error?.code === "quota_exceeded") return reply.code(429).send({ error: "quota_exceeded", message: error.message });
      if (error?.code === "ai_timeout") return reply.code(504).send({ error: "ai_timeout", message: "AI grading is taking too long. Please try again." });
      if (isRetryableAiError(error)) return reply.code(503).send({ error: "ai_unavailable", message: "AI grading is temporarily unavailable. Please try again." });
      throw error;
    }
    try {
      const submission = await prisma.quizSubmission.create({ data: { quizId: quiz.id, studentId: student.userId, score, totalPoints } });
      return reply.code(201).send({ submission: { studentId: submission.studentId, score: submission.score, totalPoints: submission.totalPoints, submittedAt: submission.submittedAt.toISOString() } });
    } catch (error: any) {
      if (error?.code === "P2002") return reply.code(409).send({ error: "already_submitted", message: "You have already submitted this quiz." });
      throw error;
    }
  });
}
