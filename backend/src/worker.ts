import { startGenerationWorker } from "./worker/generationWorker.js";

const worker = startGenerationWorker();

async function shutdown() {
  console.log("[worker] shutting down");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
