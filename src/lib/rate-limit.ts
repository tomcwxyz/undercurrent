import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Best-effort fallback used only when the durable (DB) limiter is unavailable
// — e.g. before the rate_limits table is migrated, or during a DB hiccup.
const memStore = new Map<string, RateLimitEntry>();

function checkInMemory(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

/**
 * Atomic, durable fixed-window rate limit backed by Postgres so the limit holds
 * across serverless instances. Returns true if the request is allowed.
 *
 * A single upsert increments the bucket (resetting it once the window lapses)
 * and returns the new count in one round-trip, so concurrent requests can't
 * race past the cap. Falls back to per-instance in-memory limiting if the
 * durable store is unreachable.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, now() + (${windowSeconds}::int * interval '1 second'))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.reset_at < now() THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at < now()
            THEN now() + (${windowSeconds}::int * interval '1 second')
          ELSE rate_limits.reset_at
        END
      RETURNING count
    `);
    const rows = (result.rows ?? result) as unknown as { count: number }[];
    const count = Number(rows[0]?.count ?? 1);
    return count <= maxRequests;
  } catch (err) {
    console.error(
      "[rate-limit] durable limiter unavailable, falling back to in-memory:",
      err
    );
    return checkInMemory(key, maxRequests, windowMs);
  }
}

/**
 * Best-effort client IP for rate-limit keys. Prefers the platform-set
 * `x-real-ip` (which the client cannot forge behind the proxy) over the
 * left-most `x-forwarded-for` entry, which is attacker-controlled.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}
