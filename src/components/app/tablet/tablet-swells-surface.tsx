"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SwellsSwellReading,
  SwellsSurfaceProjection,
} from "@/lib/surfaces/types";

type TabletLens = "temperature" | "horizon" | "change";

const CELL_COLOURS = [
  "rgba(108, 92, 231, 0.54)",
  "rgba(69, 183, 209, 0.62)",
  "rgba(78, 205, 196, 0.62)",
  "rgba(255, 209, 102, 0.68)",
  "rgba(255, 140, 66, 0.74)",
  "rgba(255, 107, 74, 0.82)",
] as const;

const TEMPERATURE_COLOURS = [
  "#6c5ce7",
  "#45b7d1",
  "#4ecdc4",
  "#ffd166",
  "#ff8c42",
  "#ff6b4a",
] as const;

function directionLabel(direction: SwellsSwellReading["direction"]) {
  if (direction === "strengthening") return "Strengthening ↑";
  if (direction === "new") return "New ✦";
  return "Steady →";
}

function strengthLabel(strength: SwellsSwellReading["strength"]) {
  return strength[0].toUpperCase() + strength.slice(1);
}

function SwellWave({ signal }: { signal: SwellsSwellReading }) {
  const strength =
    signal.strength === "strong" ? 1 : signal.strength === "emerging" ? 0.72 : 0.46;
  const direction =
    signal.direction === "strengthening" ? 1 : signal.direction === "new" ? 0.84 : 0.62;
  const amplitude = strength * direction;
  const peak = 118 - amplitude * 76;
  const shoulder = 146 - amplitude * 34;

  return (
    <svg
      viewBox="0 0 760 220"
      className="h-full min-h-[160px] w-full overflow-visible"
      role="img"
      aria-label={`${signal.title}, ${directionLabel(signal.direction)}`}
    >
      <defs>
        <linearGradient id={`tablet-wave-${signal.id}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.28" />
          <stop offset="52%" stopColor="#4ecdc4" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#ff8c42" stopOpacity="0.58" />
        </linearGradient>
      </defs>
      <path
        d={`M0 172 C94 172 116 ${shoulder} 194 ${shoulder} C276 ${shoulder} 290 ${peak} 380 ${peak} C470 ${peak} 488 ${shoulder} 566 ${shoulder} C644 ${shoulder} 672 172 760 172`}
        fill="none"
        stroke={`url(#tablet-wave-${signal.id})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M0 176 H760"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        strokeDasharray="5 12"
      />
    </svg>
  );
}

function TemperatureView({
  projection,
}: {
  projection: SwellsSurfaceProjection;
}) {
  const reading = projection.temperature;
  const colour =
    TEMPERATURE_COLOURS[Math.max(0, Math.min(5, reading.index))] ??
    TEMPERATURE_COLOURS[0];
  const trend =
    reading.trend === "warming"
      ? "warming ↑"
      : reading.trend === "cooling"
        ? "cooling ↓"
        : reading.trend === "steady"
          ? "steady →"
          : "this period";
  const cells = reading.cells.slice(-28);
  const missing = Math.max(0, 28 - cells.length);
  const padded = [
    ...Array.from({ length: missing }, (_, index) => ({
      date: `empty-${index}`,
      dayLabel: "",
      colorIndex: 0,
      label: "",
      count: 0,
      empty: true,
    })),
    ...cells.map((cell) => ({ ...cell, empty: false })),
  ];

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] gap-8">
      <div
        className="relative flex min-h-0 flex-col overflow-hidden rounded-[42px] border border-white/[0.07] p-8"
        style={{
          background:
            `radial-gradient(circle at 50% 46%, ${colour}22 0%, rgba(10,14,26,0.12) 52%, rgba(10,14,26,0.82) 100%)`,
        }}
      >
        <div className="flex items-center justify-between text-[0.68rem] uppercase tracking-[0.2em] text-white/55">
          <span>The temperature of things</span>
          <span>{trend}</span>
        </div>

        <div className="my-auto grid grid-cols-[minmax(0,1fr)_240px] items-end gap-10 py-8">
          <div className="grid grid-cols-7 gap-3">
            {padded.map((cell, index) => (
              <div
                key={cell.date || index}
                className="aspect-square rounded-[14px] border border-white/[0.04] transition-transform duration-500"
                style={{
                  background: cell.empty
                    ? "rgba(255,255,255,0.018)"
                    : CELL_COLOURS[Math.max(0, Math.min(5, cell.colorIndex))],
                  boxShadow:
                    !cell.empty && cell.count > 0
                      ? `0 0 30px ${CELL_COLOURS[Math.max(0, Math.min(5, cell.colorIndex))]}`
                      : "none",
                  opacity: cell.empty ? 0.34 : cell.count > 0 ? 1 : 0.48,
                }}
                title={
                  cell.empty
                    ? undefined
                    : `${cell.dayLabel}: ${cell.label}, ${cell.count} observations`
                }
              />
            ))}
          </div>

          <div className="pb-1 text-right">
            <p className="font-display text-[clamp(3.7rem,6vw,6.5rem)] font-light leading-[.82] tracking-[-.04em] text-text-primary">
              {reading.label}
            </p>
            <p className="mt-5 text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">
              current reading
            </p>
            <p className="mt-8 text-[2.2rem] font-light text-text-primary">
              {reading.observationCount}
            </p>
            <p className="text-[0.64rem] uppercase tracking-[0.16em] text-text-muted">
              observations · 28 days
            </p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3 border-t border-white/[0.055] pt-5">
          {reading.distribution.map((item, index) => (
            <div key={item.label} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.6rem] uppercase tracking-[0.1em] text-text-muted">
                  {item.label}
                </span>
                <span className="text-[0.72rem] text-text-secondary">{item.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, item.pct)}%`,
                    background: CELL_COLOURS[index] ?? CELL_COLOURS[0],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col rounded-[42px] border border-white/[0.06] bg-white/[0.025] p-7">
        <p className="text-[0.66rem] uppercase tracking-[0.18em] text-cool-1">
          How to read it
        </p>
        <h2 className="mt-5 font-display text-[2.75rem] font-light leading-[.94] text-text-primary">
          A climate, not a score.
        </h2>
        <p className="mt-5 max-w-sm text-[0.9rem] leading-[1.65] text-text-secondary">
          Warm means more energy or urgency. Cool means more calm, reflection
          or uncertainty. Neither is better.
        </p>
        <div className="mt-auto border-t border-white/[0.055] pt-5">
          <p className="text-[0.72rem] leading-[1.55] text-text-muted">
            Each square is a day. The colour comes from the observations
            noticed in this space, with the newest days at the bottom-right.
          </p>
        </div>
      </aside>
    </section>
  );
}

function HorizonView({
  signals,
}: {
  signals: SwellsSwellReading[];
}) {
  const [index, setIndex] = useState(0);
  const signal = signals[Math.min(index, Math.max(0, signals.length - 1))];

  if (!signal) {
    return (
      <section className="grid min-h-0 flex-1 place-items-center rounded-[42px] border border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-xl text-center">
          <p className="font-display text-5xl font-light">The horizon is quiet.</p>
          <p className="mt-4 text-text-muted">
            Signals will appear here as observations begin to form patterns.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)] gap-8">
      <button
        type="button"
        onClick={() => setIndex((current) => (current + 1) % signals.length)}
        className="flex min-h-0 flex-col overflow-hidden rounded-[42px] border border-white/[0.07] bg-white/[0.025] p-8 text-left"
      >
        <div className="flex items-center justify-between text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
          <span>On the horizon</span>
          <span>{index + 1}/{signals.length}</span>
        </div>
        <div className="mt-8 max-w-[920px]">
          <p className="font-display text-[clamp(3.2rem,5.2vw,5.8rem)] font-light leading-[.9] tracking-[-.035em] text-text-primary">
            {signal.title}
          </p>
          <div className="mt-5 flex items-center gap-4 text-[0.72rem] uppercase tracking-[0.14em]">
            <span className="text-cool-1">{directionLabel(signal.direction)}</span>
            <span className="text-white/20">•</span>
            <span className="text-text-muted">{strengthLabel(signal.strength)}</span>
          </div>
        </div>

        <div className="my-auto min-h-[180px] w-full">
          <SwellWave signal={signal} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-8 border-t border-white/[0.055] pt-6">
          <p className="max-w-3xl text-[1rem] leading-[1.6] text-text-secondary">
            {signal.description || "A pattern is forming across recent observations."}
          </p>
          <div className="text-right">
            <p className="text-2xl font-light text-text-primary">{signal.observationCount}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">observations</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-light text-text-primary">{signal.contributorCount}</p>
            <p className="text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">voices</p>
          </div>
        </div>
      </button>

      <aside className="min-h-0 overflow-y-auto rounded-[42px] border border-white/[0.06] bg-white/[0.02] p-3">
        {signals.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(itemIndex)}
            className={`w-full rounded-[28px] p-5 text-left transition-colors ${
              itemIndex === index ? "bg-white/[0.075]" : "hover:bg-white/[0.035]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-display text-[1.5rem] font-light leading-[1.02] text-text-primary">
                {item.title}
              </p>
              <span className="shrink-0 text-[0.62rem] text-cool-1">
                {item.direction === "strengthening" ? "↑" : item.direction === "new" ? "✦" : "→"}
              </span>
            </div>
            <p className="mt-3 text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
              {strengthLabel(item.strength)} · {item.observationCount} observations
            </p>
          </button>
        ))}
      </aside>
    </section>
  );
}

function ChangeView({
  projection,
}: {
  projection: SwellsSurfaceProjection;
}) {
  const changes = useMemo(
    () =>
      projection.changes.map((change) => ({
        ...change,
        signal: projection.swells.find((signal) => signal.id === change.signalId),
      })),
    [projection.changes, projection.swells],
  );

  if (!changes.length) {
    return (
      <section className="grid min-h-0 flex-1 place-items-center rounded-[42px] border border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-xl text-center">
          <p className="font-display text-5xl font-light">No sharp changes.</p>
          <p className="mt-4 text-text-muted">
            Nothing is currently marked as new or strengthening.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-y-auto pr-1">
      {changes.map(({ signal, ...change }) => (
        <article
          key={change.id}
          className="flex min-h-[300px] flex-col rounded-[38px] border border-white/[0.06] bg-white/[0.025] p-7"
        >
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.16em]">
            <span className="text-warm-3">
              {change.reason === "new" ? "New swell" : "Strengthening"}
            </span>
            <span className="text-text-muted">{change.observationCount} observations</span>
          </div>
          <h2 className="mt-7 max-w-2xl font-display text-[clamp(2.2rem,3.4vw,4rem)] font-light leading-[.94] text-text-primary">
            {change.title}
          </h2>
          <p className="mt-5 max-w-2xl text-[0.9rem] leading-[1.6] text-text-secondary">
            {signal?.description || "A pattern is becoming more visible across recent observations."}
          </p>
          <div className="mt-auto pt-8 text-[0.64rem] uppercase tracking-[0.12em] text-text-muted">
            {signal ? strengthLabel(signal.strength) : "Emerging"} ·{" "}
            {signal ? directionLabel(signal.direction) : "Changing"}
          </div>
        </article>
      ))}
    </section>
  );
}

export function TabletSwellsSurface({
  projection,
  spaceName,
  spaces,
}: {
  projection: SwellsSurfaceProjection;
  spaceName: string;
  spaces: Array<{ id: string; name: string }>;
}) {
  const [lens, setLens] = useState<TabletLens>("temperature");
  const router = useRouter();

  function chooseSpace(spaceId: string) {
    document.cookie = `swells-tablet-space=${spaceId}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(`/tablet/${spaceId}`);
  }

  return (
    <main className="flex h-[100dvh] min-h-[650px] flex-col overflow-hidden bg-deep px-7 pb-7 pt-6 text-text-primary">
      <header className="mb-5 flex shrink-0 items-center justify-between gap-6">
        <div className="flex items-baseline gap-5">
          <span className="font-display text-[2.25rem] font-light tracking-[-.035em]">
            swells
          </span>
          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">
            tablet surface
          </span>
        </div>

        <div className="flex items-center gap-3">
          <nav
            className="flex rounded-full border border-white/[0.06] bg-white/[0.025] p-1"
            aria-label="Swells tablet lenses"
          >
            {([
              ["temperature", "Temperature"],
              ["horizon", "Horizon"],
              ["change", "Change"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLens(id)}
                className={`rounded-full px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] transition-colors ${
                  lens === id
                    ? "bg-white/[0.1] text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <label className="sr-only" htmlFor="tablet-space">Space</label>
          <select
            id="tablet-space"
            value={projection.spaceId}
            onChange={(event) => chooseSpace(event.target.value)}
            className="max-w-[260px] rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[0.72rem] text-text-secondary outline-none"
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id} className="bg-deep">
                {space.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="mb-5 flex shrink-0 items-end justify-between border-b border-white/[0.055] pb-4">
        <div>
          <p className="text-[0.58rem] uppercase tracking-[0.18em] text-text-muted">Space</p>
          <h1 className="mt-1 font-display text-[2rem] font-light leading-none">{spaceName}</h1>
        </div>
        <p className="max-w-md text-right text-[0.72rem] leading-[1.5] text-text-muted">
          A richer output surface for the same Swells semantics. No duplicate state.
        </p>
      </div>

      {lens === "temperature" ? (
        <TemperatureView projection={projection} />
      ) : lens === "horizon" ? (
        <HorizonView signals={projection.swells} />
      ) : (
        <ChangeView projection={projection} />
      )}
    </main>
  );
}
