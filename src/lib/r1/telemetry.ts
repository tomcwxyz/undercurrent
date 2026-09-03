"use client";

export type R1InteractionEvent =
  | "surface_open"
  | "lens_view"
  | "navigate"
  | "capture_saved"
  | "capture_review_opened"
  | "capture_reviewed";

function getSessionId() {
  if (typeof window === "undefined") return "server-session";
  const key = "swells:r1:session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r1-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(key, created);
  return created;
}

export function recordR1Interaction({
  spaceId,
  event,
  lens,
  signalId,
  observationId,
  metadata,
}: {
  spaceId: string;
  event: R1InteractionEvent;
  lens?: string;
  signalId?: string;
  observationId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    spaceId,
    sessionId: getSessionId(),
    event,
    lens,
    signalId,
    observationId,
    metadata,
  });

  void fetch("/api/r1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Surface telemetry is deliberately non-critical. Never interrupt sensing.
  });
}
