import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { requireUser } from "../auth/plugin.js";
import { generationQueue } from "../../lib/queue.js";
import { consumeDailyQuota } from "../../lib/quota.js";
import type { GenerationJobDTO } from "@flashcards/shared";

function toDTO(job: Awaited<ReturnType<typeof loadJob>>): GenerationJobDTO {
  if (!job) throw new Error("job missing");
  return {
    id: job.id,
    deckId: job.deckId,
    status: job.status,
    sourceFilename: job.sourceFilename,
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
      status: d.status,
    })),
  };
}

function loadJob(jobId: string) {
  return prisma.generationJob.findUnique({ where: { id: jobId }, include: { drafts: true } });
}

export async function generationRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/api/decks/:id/generate", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, ownerId: user.userId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const allowed = await consumeDailyQuota(user.userId, "generation", env.dailyGenerationQuota);
    if (!allowed) {
      return reply.code(429).send({
        error: "quota_exceeded",
        message: `Daily PDF-generation limit (${env.dailyGenerationQuota}) reached. Try again tomorrow.`,
      });
    }

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
        const created = await tx.card.create({
          data: {
            deckId: draft.job.deckId,
            front,
            back,
            source: draft.sourceCitation ? `AI · ${draft.sourceCitation}` : "AI",
          },
        });
        await tx.aiDraft.update({
          where: { id: draft.id },
          data: {
            status: "accepted",
            resultingCardId: created.id,
            editedFront: edited ? front : draft.editedFront,
            editedBack: edited ? back : draft.editedBack,
          },
        });
        return created;
      });

      await maybeFinalizeJobAndCleanup(draft.jobId);

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
      await maybeFinalizeJobAndCleanup(draft.jobId);

      return reply.send({ ok: true });
    }
  );
}

/** Deletes the source PDF once every draft in the job has been accepted/discarded (§8: no reason to retain slides after cards are drawn). */
async function maybeFinalizeJobAndCleanup(jobId: string) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId }, include: { drafts: true } });
  if (!job) return;
  const allResolved = job.drafts.length > 0 && job.drafts.every((d) => d.status !== "pending");
  if (allResolved) {
    await fs.unlink(job.uploadPath).catch(() => {});
  }
}
