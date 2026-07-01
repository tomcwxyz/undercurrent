import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Coarse, cross-instance mutual exclusion with a TTL, backed by Postgres.
 *
 * The neon-http driver is stateless (each statement is its own connection), so
 * session-level advisory locks can't be held across awaits. Instead we use an
 * atomic upsert against `processing_locks`: the insert succeeds — or steals an
 * expired lock — only when no live lock exists, and reports that via RETURNING.
 *
 * The TTL guarantees a crashed holder can't wedge the key forever. Callers
 * should size the TTL above the worst-case critical-section time.
 */
export async function tryAcquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      INSERT INTO processing_locks (key, expires_at)
      VALUES (${key}, now() + (${ttlSeconds}::int * interval '1 second'))
      ON CONFLICT (key) DO UPDATE
        SET expires_at = now() + (${ttlSeconds}::int * interval '1 second')
        WHERE processing_locks.expires_at < now()
      RETURNING key
    `);
    const rows = (result.rows ?? result) as unknown as unknown[];
    return rows.length > 0;
  } catch (err) {
    // Table missing (pre-migration) or DB hiccup — fail OPEN so processing
    // continues. The worst case is the pre-existing behaviour (a rare duplicate),
    // which is better than stalling the pipeline entirely.
    console.error("[lock] acquire failed, proceeding without lock:", err);
    return true;
  }
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM processing_locks WHERE key = ${key}`);
  } catch (err) {
    console.error("[lock] release failed (will expire via TTL):", err);
  }
}

/**
 * Run `fn` while holding `key`. Returns `fn`'s result, or `null` if the lock is
 * already held by someone else (the caller should treat that as "handled by the
 * other holder" and move on).
 */
export async function withLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await tryAcquireLock(key, ttlSeconds);
  if (!acquired) return null;
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}
