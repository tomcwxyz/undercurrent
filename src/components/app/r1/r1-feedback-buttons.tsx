"use client";

import { useState } from "react";
import { nativeSwellsDevice } from "@/lib/r1/device";

type Judgement =
  | "useful"
  | "not_useful"
  | "fits"
  | "does_not_fit";

export function R1FeedbackButtons({
  spaceId,
  signalId,
  kind,
  question,
  answer,
  evidenceIds = [],
  mode,
}: {
  spaceId: string;
  signalId: string;
  kind: "ask_answer" | "signal_interpretation";
  question?: string;
  answer?: string;
  evidenceIds?: string[];
  mode: "ask" | "signal";
}) {
  const [saved, setSaved] = useState<Judgement | null>(null);
  const [error, setError] = useState("");

  async function send(judgement: Judgement) {
    if (saved) return;
    setError("");

    try {
      const response = await fetch("/api/r1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId,
          signalId,
          kind,
          judgement,
          question,
          answer,
          evidenceIds,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save feedback.");
      }

      setSaved(judgement);
      nativeSwellsDevice()?.haptic?.(12);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save feedback.",
      );
    }
  }

  if (saved) {
    return (
      <div className="text-[0.56rem] uppercase tracking-[0.1em] text-text-muted">
        Feedback kept ✓
      </div>
    );
  }

  const options =
    mode === "ask"
      ? ([
          ["useful", "Useful"],
          ["not_useful", "Missed it"],
        ] as const)
      : ([
          ["fits", "Fits"],
          ["does_not_fit", "Something's off"],
        ] as const);

  return (
    <div>
      <div className="flex items-center gap-2">
        {options.map(([judgement, label]) => (
          <button
            type="button"
            key={judgement}
            onClick={() => void send(judgement)}
            className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[0.56rem] uppercase tracking-[0.09em] text-text-secondary"
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-1 text-[0.62rem] text-warm-1">{error}</div>
      ) : null}
    </div>
  );
}
