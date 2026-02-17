"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import type { ObservationView, SpaceStats } from "@/lib/types";

const STRENGTH_LABELS = {
  strong: "● Strong signal",
  emerging: "◑ Emerging",
  weak: "○ Weak signal",
  single: "◊ Single",
} as const;

const STRENGTH_FILTERS = ["All", "Strong", "Emerging", "Weak", "Single"] as const;
const SENTIMENT_FILTERS = ["All", "Quiet", "Reflective", "Calm", "Warm", "Energised", "Urgent"] as const;

interface RiverViewProps {
  observations: ObservationView[];
  stats: SpaceStats;
  highlightedId?: string | null;
}

export function RiverView({ observations, stats, highlightedId }: RiverViewProps) {
  const [highlightActive, setHighlightActive] = useState<string | null>(null);
  const scrolledRef = useRef(false);
  const [search, setSearch] = useState("");
  const [strengthFilter, setStrengthFilter] = useState<string>("All");
  const [sentimentFilter, setSentimentFilter] = useState<string>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = observations;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (obs) =>
          obs.text.toLowerCase().includes(q) ||
          obs.author.toLowerCase().includes(q)
      );
    }

    if (strengthFilter !== "All") {
      const key = strengthFilter.toLowerCase();
      result = result.filter((obs) => obs.signalStrength === key);
    }

    if (sentimentFilter !== "All") {
      result = result.filter((obs) => obs.sentimentTier === sentimentFilter);
    }

    return result;
  }, [observations, search, strengthFilter, sentimentFilter]);

  const isFiltered = search || strengthFilter !== "All" || sentimentFilter !== "All";

  useEffect(() => {
    if (!highlightedId) {
      scrolledRef.current = false;
      return;
    }
    // Only scroll once per highlightedId
    if (scrolledRef.current) return;
    scrolledRef.current = true;

    const el = document.getElementById(`obs-${highlightedId}`);
    if (el) {
      // Small delay to let the view render
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightActive(highlightedId);
        // Remove highlight after 2s
        setTimeout(() => setHighlightActive(null), 2000);
      });
    }
  }, [highlightedId]);
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

      {/* Search + Filters */}
      <div className="mx-auto mb-6 max-w-[700px]">
        {/* Mobile: toggle button */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="mb-3 flex items-center gap-2 text-[0.8rem] text-text-secondary transition-colors hover:text-text-primary md:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search &amp; filter
          {isFiltered && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cool-1" />
          )}
        </button>

        <div className={`${filtersOpen ? "block" : "hidden"} md:block`}>
          {/* Search input */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search observations..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-4 text-[0.85rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
            />
          </div>

          {/* Signal strength chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="mr-1 self-center text-[0.7rem] text-text-muted">Strength:</span>
            {STRENGTH_FILTERS.map((f) => (
              <FilterChip
                key={f}
                label={f}
                active={strengthFilter === f}
                onClick={() => setStrengthFilter(f)}
              />
            ))}
          </div>

          {/* Sentiment tier chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="mr-1 self-center text-[0.7rem] text-text-muted">Mood:</span>
            {SENTIMENT_FILTERS.map((f) => (
              <FilterChip
                key={f}
                label={f}
                active={sentimentFilter === f}
                onClick={() => setSentimentFilter(f)}
              />
            ))}
          </div>
        </div>

        {/* Filtered count */}
        {isFiltered && (
          <div className="mt-3 text-center text-[0.78rem] text-text-muted">
            Showing {filtered.length} of {observations.length}
          </div>
        )}
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

        {filtered.map((obs, i) => {
          const isLeft = i % 2 === 0;
          const dotColor = SIGNAL_COLORS[obs.signalStrength].css;

          return (
            <div
              key={obs.id}
              id={`obs-${obs.id}`}
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
                <ObservationCard obs={obs} dotColor={dotColor} highlighted={highlightActive === obs.id} />
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
  highlighted,
}: {
  obs: ObservationView;
  dotColor: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`group cursor-pointer rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-white/8 hover:bg-card-hover hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] ${highlighted ? "border-cool-1/40 ring-2 ring-cool-1/30" : "border-white/[0.04]"}`}>
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[0.72rem] transition-all ${
        active
          ? "bg-cool-1/15 text-cool-1 font-medium"
          : "bg-white/[0.03] text-text-muted hover:text-text-secondary hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
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
