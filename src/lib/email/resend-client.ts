import { Resend } from "resend";

let _resend: Resend | null = null;

/**
 * Returns null when RESEND_API_KEY isn't set, rather than throwing — email
 * sending is optional today (Phase 9 is still deferred). Callers must treat
 * a null return as "skip sending, nothing failed" so the attention cron
 * keeps working via in-app notifications alone until Resend is configured.
 */
export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const DIGEST_FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";
