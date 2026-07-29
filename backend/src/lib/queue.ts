import { Queue } from "bullmq";
import { redis } from "../redis.js";

export interface GenerationJobPayload {
  jobId: string;
}

export const generationQueue = new Queue<GenerationJobPayload>("generation", {
  connection: redis,
  defaultJobOptions: {
    // Provider-level retries are short; queue retries let an import recover
    // from a longer Gemini/Anthropic outage without user intervention.
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
