import { redis } from "../redis.js";

const QUOTA_TTL_SECONDS = 60 * 60 * 25;

function quotaKey(userId: string, bucket: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `rate:${bucket}:${userId}:${day}`;
}

/** Reserves one per-user, per-day quota slot without incrementing beyond the limit. */
export async function consumeDailyQuota(userId: string, bucket: string, limit: number): Promise<boolean> {
  const reserved = await redis.eval(
    `local current = tonumber(redis.call('GET', KEYS[1]) or '0')
     if current >= tonumber(ARGV[1]) then return 0 end
     local next = redis.call('INCR', KEYS[1])
     if next == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
     return 1`,
    1,
    quotaKey(userId, bucket),
    String(limit),
    String(QUOTA_TTL_SECONDS)
  );
  return Number(reserved) === 1;
}

/** Releases a previously reserved slot when its AI request did not complete. */
export async function releaseDailyQuota(userId: string, bucket: string): Promise<void> {
  const key = quotaKey(userId, bucket);
  const remaining = await redis.decr(key);
  if (remaining <= 0) await redis.del(key);
}
