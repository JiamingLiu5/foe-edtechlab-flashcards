import { redis } from "../redis.js";

/** Per-user, per-day counter in Redis. Returns true if the call is allowed (and records it). */
export async function consumeDailyQuota(userId: string, bucket: string, limit: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rate:${bucket}:${userId}:${day}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60 * 25); // a little over a day, covers timezone slop
  }
  return count <= limit;
}
