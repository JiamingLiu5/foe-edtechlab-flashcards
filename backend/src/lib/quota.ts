import { redis } from "../redis.js";
import { prisma } from "../db.js";

const QUOTA_TTL_SECONDS = 60 * 60 * 25;

function quotaKey(userId: string, bucket: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `rate:${bucket}:${userId}:${day}`;
}

/** An admin-set override replaces the env-configured default limit for one user/bucket. */
export async function getEffectiveQuotaLimit(userId: string, bucket: string, defaultLimit: number): Promise<number> {
  const override = await prisma.quotaOverride.findUnique({ where: { userId_bucket: { userId, bucket } } });
  return override?.dailyLimit ?? defaultLimit;
}

/** Every override set for a user, keyed by bucket — used to render the admin quota panel in one query. */
export async function getQuotaOverridesForUser(userId: string): Promise<Map<string, number>> {
  const overrides = await prisma.quotaOverride.findMany({ where: { userId } });
  return new Map(overrides.map((o) => [o.bucket, o.dailyLimit]));
}

/** Sets (or, with `dailyLimit: null`, clears) a per-user override for a quota bucket. */
export async function setQuotaOverride(userId: string, bucket: string, dailyLimit: number | null): Promise<void> {
  if (dailyLimit === null) {
    await prisma.quotaOverride.deleteMany({ where: { userId, bucket } });
    return;
  }
  await prisma.quotaOverride.upsert({
    where: { userId_bucket: { userId, bucket } },
    update: { dailyLimit },
    create: { userId, bucket, dailyLimit },
  });
}

/** How many of today's slots a user has already used for a bucket, without reserving one. */
export async function getDailyQuotaUsage(userId: string, bucket: string): Promise<number> {
  const value = await redis.get(quotaKey(userId, bucket));
  return value ? Number(value) : 0;
}

/** Clears a user's usage counter for a bucket, restoring their full daily allowance. */
export async function resetDailyQuota(userId: string, bucket: string): Promise<void> {
  await redis.del(quotaKey(userId, bucket));
}

/** Reserves one per-user, per-day quota slot without incrementing beyond the limit (an admin override, if set, replaces `defaultLimit`). */
export async function consumeDailyQuota(
  userId: string,
  bucket: string,
  defaultLimit: number
): Promise<{ allowed: boolean; limit: number }> {
  const limit = await getEffectiveQuotaLimit(userId, bucket, defaultLimit);
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
  return { allowed: Number(reserved) === 1, limit };
}

/** Releases a previously reserved slot when its AI request did not complete. */
export async function releaseDailyQuota(userId: string, bucket: string): Promise<void> {
  const key = quotaKey(userId, bucket);
  const remaining = await redis.decr(key);
  if (remaining <= 0) await redis.del(key);
}
