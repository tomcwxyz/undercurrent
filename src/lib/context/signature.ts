import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function secret() {
  const value = process.env.CONTEXT_INGEST_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CONTEXT_INGEST_SECRET must be at least 32 characters");
  }
  return value;
}

function expectedSignature(timestamp: string, body: string) {
  return createHmac("sha256", secret())
    .update(`${timestamp}.${body}`)
    .digest("base64url");
}

/**
 * Verify a short-lived HMAC envelope used by the pilot connector host.
 * Signature format: base64url(HMAC_SHA256(secret, `${timestamp}.${rawBody}`)).
 */
export function verifyContextDelivery(
  rawBody: string,
  timestamp: string | null,
  suppliedSignature: string | null,
  now = Date.now(),
) {
  if (!timestamp || !suppliedSignature) return false;
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(now - timestampMs) > MAX_CLOCK_SKEW_MS) return false;

  const expected = Buffer.from(expectedSignature(timestamp, rawBody), "utf8");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
