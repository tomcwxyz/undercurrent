import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless one-click unsubscribe token — no DB round trip needed to issue
 * or verify. Derived from NextAuth's AUTH_SECRET rather than requiring a new
 * env var, but via a labeled HMAC subkey (not the raw secret) so this stays
 * cryptographically separate from session signing — a leak here can't be
 * used to forge sessions, and rotating one doesn't silently invalidate the
 * other's tokens as a side effect.
 */
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update("email-unsubscribe-token-v1").digest();
}

function sign(userId: string, spaceId: string): string {
  return createHmac("sha256", deriveKey()).update(`${userId}:${spaceId}`).digest("hex");
}

export function signUnsubscribeToken(userId: string, spaceId: string): string {
  return sign(userId, spaceId);
}

export function verifyUnsubscribeToken(
  userId: string,
  spaceId: string,
  token: string
): boolean {
  const expected = Buffer.from(sign(userId, spaceId));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
