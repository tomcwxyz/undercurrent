import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { sql, lt } from "drizzle-orm";

/**
 * Fixed-window rate limiter backed by Postgres (Neon), not in-memory —
 * serverless invocations don't share process memory, so a Map-based limiter
 * doesn't actually limit anything across instances.
 *
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < ${now} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });

  // Opportunistic cleanup — keys that never come back (e.g. one-off IPs)
  // would otherwise accumulate forever. No cron needed at this traffic
  // volume; a small random chance per call keeps the table bounded.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
  }

  return row.count <= maxRequests;
}
