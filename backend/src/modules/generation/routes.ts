import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { requireUser } from "../auth/plugin.js";
import { generationQueue } from "../../lib/queue.js";
import { consumeDailyQuota, getEffectiveQuotaLimit } from "../../lib/quota.js";
import type { GenerationJobDTO } from "@flashcards/shared";

function toDTO(job: Awaited<ReturnType<typeof loadJob>>): GenerationJobDTO {
  if (!job) throw new Error("job missing");
  return {
    id: job.id,
    deckId: job.deckId,
    status: job.status,
    kind: job.kind,
    sourceType: job.sourceType,
    sourceFilename: job.sourceFilename,
    cardLimit: job.cardLimit,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    drafts: job.drafts.map((d) => ({
      id: d.id,
      jobId: d.jobId,
      generatedFront: d.generatedFront,
      generatedBack: d.generatedBack,
      editedFront: d.editedFront,
      editedBack: d.editedBack,
      sourceCitation: d.sourceCitation,
      issue: d.issue,
      originalCardId: d.originalCardId,
      originalFront: d.originalCard?.front ?? null,
      originalBack: d.originalCard?.back ?? null,
      status: d.status,
    })),
  };
}

function parseCardLimit(value: unknown, maximum: number): number | null {
  const requested = value === undefined || value === "" ? Math.min(25, maximum) : Number(value);
  if (!Number.isInteger(requested) || requested < 1 || requested > maximum) return null;
  return requested;
}

function loadJob(jobId: string) {
  return prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { drafts: { include: { originalCard: true } } },
  });
}

export async function generationRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/api/decks/:id/generate", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "missing_file", message: "Upload a PDF file." });
    if (file.mimetype !== "application/pdf") {
      return reply.code(400).send({ error: "invalid_type", message: "Only PDF uploads are supported." });
    }

    const buffer = await file.toBuffer();
    if (buffer.byteLength > env.maxUploadBytes) {
      return reply.code(413).send({
        error: "file_too_large",
        message: `PDF exceeds the ${env.maxUploadBytes / (1024 * 1024)}MB limit.`,
      });
    }

    // Reading the file ensures multipart fields that follow it have been parsed too.
    const maxGeneratedCards = await getEffectiveQuotaLimit(user.userId, "generated_card_limit", env.maxGeneratedCards);
    const multipartFields = (file as { fields?: Record<string, { value?: unknown }> }).fields;
    const cardLimit = parseCardLimit(multipartFields?.cardLimit?.value, maxGeneratedCards);
    if (cardLimit === null) {
      return reply.code(400).send({
        error: "invalid_card_limit",
        message: `Choose a whole number of cards from 1 to ${maxGeneratedCards}.`,
      });
    }

    let pageCount: number;
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdf.getPageCount();
    } catch {
      return reply.code(400).send({ error: "invalid_pdf", message: "The uploaded file could not be read as a PDF." });
    }

    const pageLimit = await getEffectiveQuotaLimit(user.userId, "pdf_page_limit", env.maxPdfPages);
    if (pageCount > pageLimit) {
      return reply.code(413).send({
        error: "pdf_page_limit_exceeded",
        message: `This PDF has ${pageCount} pages. Your upload limit is ${pageLimit} pages.`,
      });
    }

    const quota = await consumeDailyQuota(user.userId, "generation", env.dailyGenerationQuota);
    if (!quota.allowed) {
      return reply.code(429).send({
        error: "quota_exceeded",
        message: `Daily PDF-generation limit (${quota.limit}) reached. Try again tomorrow.`,
      });
    }

    await fs.mkdir(env.uploadDir, { recursive: true });
    const storedName = `${crypto.randomUUID()}.pdf`;
    const uploadPath = path.join(env.uploadDir, storedName);
    await fs.writeFile(uploadPath, buffer);

    const job = await prisma.generationJob.create({
      data: {
        deckId: deck.id,
        requestedById: user.userId,
        sourceFilename: file.filename,
        uploadPath,
        cardLimit,
        status: "queued",
      },
    });

    await generationQueue.add("generate", { jobId: job.id });

    return reply.code(202).send({ job: toDTO({ ...job, drafts: [] }) });
  });

  app.post<{ Params: { id: string }; Body: { url?: string; cardLimit?: number } }>("/api/decks/:id/generate-url", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const url = req.body?.url?.trim();
    if (!url) return reply.code(400).send({ error: "missing_url", message: "Enter a URL to import." });
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      return reply.code(400).send({ error: "invalid_url", message: "Enter a valid http(s) URL." });
    }

    const maxGeneratedCards = await getEffectiveQuotaLimit(user.userId, "generated_card_limit", env.maxGeneratedCards);
    const cardLimit = parseCardLimit(req.body?.cardLimit, maxGeneratedCards);
    if (cardLimit === null) {
      return reply.code(400).send({
        error: "invalid_card_limit",
        message: `Choose a whole number of cards from 1 to ${maxGeneratedCards}.`,
      });
    }

    const quota = await consumeDailyQuota(user.userId, "generation", env.dailyGenerationQuota);
    if (!quota.allowed) {
      return reply.code(429).send({
        error: "quota_exceeded",
        message: `Daily generation limit (${quota.limit}) reached. Try again tomorrow.`,
      });
    }

    const job = await prisma.generationJob.create({
      data: {
        deckId: deck.id,
        requestedById: user.userId,
        kind: "import",
        sourceType: "url",
        sourceFilename: url,
        sourceUrl: url,
        cardLimit,
        status: "queued",
      },
    });

    await generationQueue.add("generate", { jobId: job.id });

    return reply.code(202).send({ job: toDTO({ ...job, drafts: [] }) });
  });

  app.post<{ Params: { id: string } }>("/api/decks/:id/review", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cardCount = await prisma.card.count({ where: { deckId: deck.id } });
    if (cardCount === 0) {
      return reply.code(400).send({ error: "empty_deck", message: "This deck has no cards to review yet." });
    }

    const quota = await consumeDailyQuota(user.userId, "deck_review", env.dailyDeckReviewQuota);
    if (!quota.allowed) {
      return reply.code(429).send({
        error: "quota_exceeded",
        message: `Daily AI-review limit (${quota.limit}) reached. Try again tomorrow.`,
      });
    }

    const job = await prisma.generationJob.create({
      data: {
        deckId: deck.id,
        requestedById: user.userId,
        kind: "review",
        sourceType: "pdf",
        sourceFilename: deck.name,
        status: "queued",
      },
    });

    await generationQueue.add("generate", { jobId: job.id });

    return reply.code(202).send({ job: toDTO({ ...job, drafts: [] }) });
  });

  app.get<{ Params: { id: string } }>("/api/generation-jobs/:id", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const job = await loadJob(req.params.id);
    if (!job) return reply.code(404).send({ error: "not_found", message: "Job not found." });

    const deck = await prisma.deck.findFirst({ where: { id: job.deckId, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Job not found." });

    return reply.send({ job: toDTO(job) });
  });

  app.post<{ Params: { id: string; draftId: string }; Body: { front?: string; back?: string } }>(
    "/api/generation-jobs/:id/drafts/:draftId/accept",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;

      const draft = await prisma.aiDraft.findUnique({
        where: { id: req.params.draftId },
        include: { job: { include: { deck: true } } },
      });
      if (!draft || draft.jobId !== req.params.id || draft.job.deck.ownerId !== user.userId) {
        return reply.code(404).send({ error: "not_found", message: "Draft not found." });
      }
      if (draft.status !== "pending") {
        return reply.code(409).send({ error: "already_resolved", message: "This draft was already resolved." });
      }

      const front = req.body?.front?.trim() || draft.editedFront || draft.generatedFront;
      const back = req.body?.back?.trim() || draft.editedBack || draft.generatedBack;
      const edited = front !== draft.generatedFront || back !== draft.generatedBack;

      const card = await prisma.$transaction(async (tx) => {
        const resulting = draft.originalCardId
          ? await tx.card.update({ where: { id: draft.originalCardId }, data: { front, back } })
          : await tx.card.create({
              data: {
                deckId: draft.job.deckId,
                front,
                back,
                source: draft.sourceCitation ? `AI · ${draft.sourceCitation}` : "AI",
                // Ask the owner whether to include new AI cards in quizzes
                // immediately after acceptance; manual and existing cards keep
                // the schema default of true.
                includeInQuiz: false,
              },
            });
        await tx.aiDraft.update({
          where: { id: draft.id },
          data: {
            status: "accepted",
            // resultingCardId is unique per card: only set it for imports, which mint a brand-new card.
            // Review drafts point at an existing card (originalCardId) that may be reviewed again later.
            resultingCardId: draft.originalCardId ? undefined : resulting.id,
            editedFront: edited ? front : draft.editedFront,
            editedBack: edited ? back : draft.editedBack,
          },
        });
        return resulting;
      });

      return reply.send({ card });
    }
  );

  app.post<{ Params: { id: string; draftId: string } }>(
    "/api/generation-jobs/:id/drafts/:draftId/discard",
    async (req, reply) => {
      const user = requireUser(req, reply);
      if (!user) return;

      const draft = await prisma.aiDraft.findUnique({
        where: { id: req.params.draftId },
        include: { job: { include: { deck: true } } },
      });
      if (!draft || draft.jobId !== req.params.id || draft.job.deck.ownerId !== user.userId) {
        return reply.code(404).send({ error: "not_found", message: "Draft not found." });
      }
      if (draft.status !== "pending") {
        return reply.code(409).send({ error: "already_resolved", message: "This draft was already resolved." });
      }

      await prisma.aiDraft.update({ where: { id: draft.id }, data: { status: "discarded" } });

      return reply.send({ ok: true });
    }
  );
}
