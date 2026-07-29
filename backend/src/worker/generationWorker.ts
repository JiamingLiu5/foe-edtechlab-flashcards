import fs from "node:fs/promises";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { redis } from "../redis.js";
import { prisma } from "../db.js";
import { generateCardsFromText, reviewCards } from "../lib/claude.js";
import { extractPdfText } from "../lib/gemini.js";
import { isRetryableAiError } from "../lib/retry.js";
import { releaseDailyQuota } from "../lib/quota.js";
import { extractUrlText } from "../lib/urlExtract.js";
import type { GenerationJobPayload } from "../lib/queue.js";

const REVIEW_BATCH_SIZE = 20;

/** Maps a job kind back onto the quota bucket that was reserved for it when the job was created. */
function quotaBucketForJob(kind: string): string {
  return kind === "review" ? "deck_review" : "generation";
}

async function processImportJob(job: {
  id: string;
  deckId: string;
  kind: string;
  requestedById: string;
  sourceFilename: string;
  sourceType: string;
  sourceUrl: string | null;
  uploadPath: string | null;
  cardLimit: number;
}) {
  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "extracting" } });

  const sourceText =
    job.sourceType === "url"
      ? (await extractUrlText(job.sourceUrl!)).text
      : await extractPdfText({
          pdfBase64: (await fs.readFile(job.uploadPath!)).toString("base64"),
          filename: job.sourceFilename,
        });

  const styleReferenceCards = await prisma.card.findMany({
    where: { deckId: job.deckId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { front: true, back: true },
  });

  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "generating" } });

  // Prompt the model with the requested limit and also truncate defensively:
  // provider output is never trusted as the enforcement mechanism.
  const generated = (await generateCardsFromText({
    slideText: sourceText,
    filename: job.sourceFilename,
    cardLimit: job.cardLimit,
    styleReferenceCards,
  })).slice(0, job.cardLimit);

  if (!generated.length) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: "No groundable cards could be drawn from this source." },
    });
    await releaseDailyQuota(job.requestedById, quotaBucketForJob(job.kind));
    return;
  }

  await prisma.$transaction([
    ...generated.map((card) =>
      prisma.aiDraft.create({
        data: {
          jobId: job.id,
          generatedFront: card.front,
          generatedBack: card.back,
          sourceCitation: card.citation,
        },
      })
    ),
    prisma.generationJob.update({ where: { id: job.id }, data: { status: "ready" } }),
  ]);
}

async function processReviewJob(job: { id: string; deckId: string }) {
  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "generating" } });

  const cards = await prisma.card.findMany({
    where: { deckId: job.deckId },
    orderBy: { createdAt: "asc" },
    select: { id: true, front: true, back: true },
  });

  const flags = [];
  for (let i = 0; i < cards.length; i += REVIEW_BATCH_SIZE) {
    const batch = cards.slice(i, i + REVIEW_BATCH_SIZE);
    flags.push(...(await reviewCards(batch)));
  }

  await prisma.$transaction([
    ...flags.map((flag) =>
      prisma.aiDraft.create({
        data: {
          jobId: job.id,
          generatedFront: flag.front,
          generatedBack: flag.back,
          issue: flag.issue,
          originalCardId: flag.cardId,
        },
      })
    ),
    prisma.generationJob.update({ where: { id: job.id }, data: { status: "ready" } }),
  ]);
}

async function processJob(bullJob: Job<GenerationJobPayload>) {
  const { jobId } = bullJob.data;
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    if (job.kind === "review") {
      await processReviewJob(job);
    } else {
      await processImportJob(job);
    }
  } catch (err) {
    if (isRetryableAiError(err)) {
      // Do not swallow this error: BullMQ must see it to apply the queue
      // backoff/retry policy for outages such as Gemini HTTP 503.
      console.warn(`[generation-worker] job ${jobId} failed transiently; BullMQ will retry it.`, err);
      throw err;
    }

    console.error(`[generation-worker] job ${jobId} failed permanently:`, err);
    // The owner may have deleted their account while this job was processing.
    // updateMany makes that race a clean no-op instead of causing needless retries.
    const { count } = await prisma.generationJob.updateMany({
      where: { id: jobId },
      data: { status: "failed", error: err instanceof Error ? err.message : "Unknown error" },
    });
    if (count > 0) await releaseDailyQuota(job.requestedById, quotaBucketForJob(job.kind));
    throw new UnrecoverableError(err instanceof Error ? err.message : "Unknown error");
  }
}

export function startGenerationWorker() {
  const worker = new Worker<GenerationJobPayload>(
    "generation",
    (job) => processJob(job),
    { connection: redis, concurrency: 2 }
  );

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) return;

    const maxAttempts = bullJob.opts.attempts ?? 1;
    if (bullJob.attemptsMade < maxAttempts) {
      console.warn(
        `[generation-worker] bullmq job ${bullJob.id} attempt ${bullJob.attemptsMade}/${maxAttempts} failed; retry scheduled.`
      );
      return;
    }

    console.error(`[generation-worker] bullmq job ${bullJob.id} exhausted its retries:`, err);
    const job = await prisma.generationJob.findUnique({ where: { id: bullJob.data.jobId } });
    if (!job || job.status === "failed") return;

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: err instanceof Error ? err.message : "Unknown error" },
    });
    await releaseDailyQuota(job.requestedById, quotaBucketForJob(job.kind));
  });

  console.log("[generation-worker] started, waiting for jobs");
  return worker;
}
