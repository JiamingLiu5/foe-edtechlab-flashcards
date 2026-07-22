import fs from "node:fs/promises";
import { Worker, type Job } from "bullmq";
import { redis } from "../redis.js";
import { prisma } from "../db.js";
import { generateCardsFromText } from "../lib/claude.js";
import { extractPdfText } from "../lib/gemini.js";
import type { GenerationJobPayload } from "../lib/queue.js";

async function processJob(bullJob: Job<GenerationJobPayload>) {
  const { jobId } = bullJob.data;
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "extracting" } });

    const pdfBuffer = await fs.readFile(job.uploadPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const slideText = await extractPdfText({ pdfBase64, filename: job.sourceFilename });

    const styleReferenceCards = await prisma.card.findMany({
      where: { deckId: job.deckId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { front: true, back: true },
    });

    await prisma.generationJob.update({ where: { id: jobId }, data: { status: "generating" } });

    const generated = await generateCardsFromText({
      slideText,
      filename: job.sourceFilename,
      styleReferenceCards,
    });

    if (!generated.length) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "failed", error: "No groundable cards could be drawn from this PDF." },
      });
      return;
    }

    await prisma.$transaction([
      ...generated.map((card) =>
        prisma.aiDraft.create({
          data: {
            jobId,
            generatedFront: card.front,
            generatedBack: card.back,
            sourceCitation: card.citation,
          },
        })
      ),
      prisma.generationJob.update({ where: { id: jobId }, data: { status: "ready" } }),
    ]);
  } catch (err) {
    console.error(`[generation-worker] job ${jobId} failed:`, err);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", error: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}

export function startGenerationWorker() {
  const worker = new Worker<GenerationJobPayload>(
    "generation",
    (job) => processJob(job),
    { connection: redis, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[generation-worker] bullmq job ${job?.id} errored:`, err);
  });

  console.log("[generation-worker] started, waiting for jobs");
  return worker;
}
