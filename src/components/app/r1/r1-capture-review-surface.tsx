"use client";

import type { R1CaptureReview } from "@/lib/r1/use-capture-review";

function directionLabel(direction: R1CaptureReview["signals"][number]["direction"]) {
  if (direction === "strengthening") return "Strengthening ↑";
  if (direction === "new") return "New ✦";
  return "Steady →";
}

export function R1CaptureReviewSurface({
  review,
  deciding,
  error,
  onDecision,
}: {
  review: R1CaptureReview;
  deciding: boolean;
  error: string;
  onDecision: (decision: "keep_connection" | "keep_separate") => void;
}) {
  if (review.processing) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5">
        <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.14em] text-text-muted">
          <span>Notice kept ✓</span>
          <span>Listening</span>
        </div>

        <div className="my-auto">
          <div className="relative mx-auto mb-5 h-24 w-24">
            <div className="absolute inset-2 rounded-full border border-cool-1/15" />
            <div className="absolute inset-5 animate-pulse rounded-full border border-cool-1/30" />
            <div className="absolute inset-9 rounded-full bg-cool-1/70 shadow-[0_0_34px_rgba(103,214,224,0.3)]" />
          </div>
          <h2 className="font-display text-[2.15rem] font-light leading-[0.96] text-text-primary">
            Seeing what it connects to…
          </h2>
          <p className="mt-3 max-w-[330px] text-[0.72rem] leading-relaxed text-text-secondary">
            Your observation is safe. Swells is transcribing and comparing it with the patterns already forming.
          </p>
          {review.text ? (
            <p className="mt-3 line-clamp-2 rounded-[16px] border border-white/[0.05] bg-black/10 px-3 py-2 text-[0.68rem] leading-relaxed text-text-muted">
              “{review.text}”
            </p>
          ) : null}
        </div>

        <div className="text-[0.56rem] uppercase tracking-[0.1em] text-text-muted">
          You can leave Swells. This review will still be here.
        </div>
      </div>
    );
  }

  const primary = review.signals[0];
  const extras = review.signals.slice(1);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5">
      <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.14em] text-text-muted">
        <span>Review this notice</span>
        <span>Human judgement</span>
      </div>

      <div className="mt-5">
        <div className="text-[0.58rem] uppercase tracking-[0.12em] text-cool-1">
          {primary ? "Swells connected it to" : "Swells kept it separate"}
        </div>
        <h2 className="mt-2 line-clamp-3 font-display text-[2.15rem] font-light leading-[0.96] text-text-primary">
          {primary?.title ?? "No swell yet"}
        </h2>
        {primary ? (
          <div className="mt-2 flex items-center gap-2 text-[0.58rem] uppercase tracking-[0.1em]">
            <span className="text-cool-1">{directionLabel(primary.direction)}</span>
            <span className="text-white/20">•</span>
            <span className="text-text-muted">{primary.strength}</span>
          </div>
        ) : null}
      </div>

      <div className="my-auto">
        <p className="line-clamp-3 text-[0.72rem] leading-[1.5] text-text-secondary">
          {review.text || "This voice observation has been processed."}
        </p>

        {primary?.description ? (
          <p className="mt-3 line-clamp-2 rounded-[16px] border border-white/[0.05] bg-black/10 px-3 py-2 text-[0.68rem] leading-relaxed text-text-muted">
            {primary.description}
          </p>
        ) : null}

        {extras.length ? (
          <div className="mt-2 line-clamp-2 text-[0.6rem] leading-relaxed text-text-muted">
            Also connected to {extras.map((signal) => signal.title).join(", ")}.
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 text-[0.7rem] leading-relaxed text-warm-1">{error}</div>
      ) : null}

      {primary ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={deciding}
            onClick={() => onDecision("keep_connection")}
            className="rounded-[16px] border border-cool-1/25 bg-cool-1/10 px-3 py-3 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-cool-1 disabled:opacity-40"
          >
            Keep here
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => onDecision("keep_separate")}
            className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-text-secondary disabled:opacity-40"
          >
            Keep separate
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={deciding}
          onClick={() => onDecision("keep_connection")}
          className="w-full rounded-[16px] border border-cool-1/25 bg-cool-1/10 px-3 py-3 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-cool-1 disabled:opacity-40"
        >
          Looks right
        </button>
      )}
    </div>
  );
}
