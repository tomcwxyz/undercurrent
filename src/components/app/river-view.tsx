"use client";

import { SIGNAL_COLORS } from "@/lib/mock-data";
import type { ObservationView, SpaceStats } from "@/lib/types";

const STRENGTH_LABELS = {
  strong: "● Strong signal",
  emerging: "◑ Emerging",
  weak: "○ Weak signal",
  single: "◊ Single",
} as const;

interface RiverViewProps {
  observations: ObservationView[];
  stats: SpaceStats;
}

export function RiverView({ observations, stats }: RiverViewProps) {
  return (
    <div className="relative max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light text-text-primary opacity-90">
          The flow of observations
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          Everything noticed by your team in the last 30 days, flowing through
          time.
        </p>
        <div className="mt-6 flex justify-center gap-6 md:gap-12">
          <Stat value={String(stats.observationCount)} label="Observations" />
          <Stat value={String(stats.signalCount)} label="Signals emerging" />
        </div>
      </div>

      {/* Stream */}
      <div className="relative mx-auto max-w-[700px] py-5">
        {/* Centre line (desktop) */}
        <div
          className="absolute left-1/2 top-0 bottom-0 hidden w-0.5 -translate-x-1/2 md:block"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(78,205,196,0.2) 10%, rgba(78,205,196,0.1) 50%, rgba(255,107,74,0.1) 80%, transparent)",
          }}
        />

        {/* Mobile line */}
        <div
          className="absolute left-[7px] top-0 bottom-0 w-0.5 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(78,205,196,0.2) 10%, rgba(78,205,196,0.1) 50%, rgba(255,107,74,0.1) 80%, transparent)",
          }}
        />

        {observations.map((obs, i) => {
          const isLeft = i % 2 === 0;
          const dotColor = SIGNAL_COLORS[obs.signalStrength].css;

          return (
            <div
              key={obs.id}
              className="relative mb-6"
              style={{
                animation: "fade-up 0.6s ease forwards",
                animationDelay: `${i * 0.1}s`,
                animationFillMode: "both",
              }}
            >
              {/* Dot on centre line (desktop) */}
              <div
                className="absolute left-1/2 top-6 z-[2] hidden h-3 w-3 -translate-x-1/2 rounded-full md:block"
                style={{
                  background: dotColor,
                  boxShadow: `0 0 20px ${dotColor}`,
                }}
              />

              {/* Mobile dot */}
              <div
                className="absolute left-0.5 top-6 z-[2] h-3 w-3 rounded-full md:hidden"
                style={{
                  background: dotColor,
                  boxShadow: `0 0 20px ${dotColor}`,
                }}
              />

              {/* Card positioned left or right of centre */}
              <div
                className={
                  isLeft
                    ? "pl-8 md:pl-0 md:pr-[calc(50%+24px)]"
                    : "pl-8 md:pl-[calc(50%+24px)] md:pr-0"
                }
              >
                <ObservationCard obs={obs} dotColor={dotColor} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObservationCard({
  obs,
  dotColor,
}: {
  obs: ObservationView;
  dotColor: string;
}) {
  return (
    <div className="group cursor-pointer rounded-2xl border border-white/[0.04] bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-white/8 hover:bg-card-hover hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
      {obs.hasImage && (
        <div className="mb-3 flex h-[120px] w-full items-center justify-center rounded-[10px] bg-gradient-to-br from-cool-1/10 to-cool-3/10 text-[0.75rem] text-text-muted">
          <svg
            className="mr-2"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {obs.imageLabel}
        </div>
      )}

      <div className="text-[0.72rem] tracking-wide text-text-muted">
        {obs.time} · {obs.author}
      </div>
      <div className="mt-1.5 text-[0.92rem] leading-relaxed text-text-primary">
        {obs.text}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-[10px] px-2.5 py-0.5 text-[0.7rem] font-medium"
          style={{
            background: `color-mix(in srgb, ${dotColor} 12%, transparent)`,
            color: dotColor,
          }}
        >
          {STRENGTH_LABELS[obs.signalStrength]}
        </span>
        {obs.hasImage && (
          <span className="inline-flex items-center gap-1 rounded-[10px] bg-cool-3/12 px-2.5 py-0.5 text-[0.7rem] font-medium text-cool-3">
            ◐ Photo attached
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-[2.4rem] font-light bg-gradient-to-r from-cool-1 to-warm-3 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="mt-1 text-[0.75rem] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}
