import { Queue } from "bullmq";
import { redis } from "../redis.js";

export interface GenerationJobPayload {
  jobId: string;
}

export const generationQueue = new Queue<GenerationJobPayload>("generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
