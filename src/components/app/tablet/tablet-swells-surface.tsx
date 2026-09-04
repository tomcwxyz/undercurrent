"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TabletAskPanel } from "@/components/app/tablet/tablet-ask-panel";
import { TabletNoticeComposer } from "@/components/app/tablet/tablet-notice-composer";
import type { ObservationView } from "@/lib/types";
import type {
  SwellsSwellReading,
  SwellsSurfaceProjection,
} from "@/lib/surfaces/types";

type TabletLens = "temperature" | "horizon" | "explore";

type SignalHistoryItem = {
  id: string;
  signalId: string;
  snapshotAt: string;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
};

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

const NODE_POSITIONS = [
  [18, 22],
  [49, 15],
  [79, 25],
  [30, 49],
  [66, 48],
  [15, 76],
  [48, 78],
  [82, 73],
  [50, 48],
  [83, 48],
] as const;

function directionLabel(direction: SwellsSwellReading["direction"]) {
  if (direction === "strengthening") return "Strengthening ↑";
  if (direction === "new") return "New ✦";
  return "Steady →";
}

function strengthLabel(strength: SwellsSwellReading["strength"]) {
  return strength[0].toUpperCase() + strength.slice(1);
}

function strengthWeight(strength: SwellsSwellReading["strength"]) {
  if (strength === "strong") return 1;
  if (strength === "emerging") return 0.72;
  return 0.46;
}

function MiniWave({ signal }: { signal: SwellsSwellReading }) {
  const strength = strengthWeight(signal.strength);
  const direction =
    signal.direction === "strengthening" ? 1 : signal.direction === "new" ? 0.84 : 0.62;
  const peak = 74 - strength * direction * 42;
  return (
    <svg viewBox="0 0 320 96" className="h-20 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`tablet-mini-${signal.id}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.25" />
          <stop offset="55%" stopColor="#4ecdc4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff8c42" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d={`M0 75 C45 75 60 61 92 61 C126 61 137 ${peak} 160 ${peak} C190 ${peak} 201 61 230 61 C263 61 280 75 320 75`}
        fill="none"
        stroke={`url(#tablet-mini-${signal.id})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TemperatureView({
  projection,
  onOpenSignal,
}: {
  projection: SwellsSurfaceProjection;
  onOpenSignal: (signalId: string) => void;
}) {
  const reading = projection.temperature;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const colour = TEMPERATURE_COLOURS[Math.max(0, Math.min(5, reading.index))];
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
      observations: [],
      empty: true,
    })),
    ...cells.map((cell) => ({ ...cell, empty: false })),
  ];
  const selected = selectedDay === null ? null : padded[selectedDay];
  const changing = projection.swells.filter(
    (signal) => signal.direction === "new" || signal.direction === "strengthening",
  );

  return (
    <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
      <div
        className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[36px] border border-white/[0.07] p-6 md:p-8"
        style={{
          background: `radial-gradient(circle at 48% 42%, ${colour}1f 0%, rgba(10,14,26,0.12) 48%, rgba(10,14,26,0.86) 100%)`,
        }}
      >
        <div className="flex items-center justify-between text-[0.64rem] uppercase tracking-[0.18em] text-white/55">
          <span>The temperature of things</span>
          <span>{trend}</span>
        </div>

        <div className="my-auto grid items-end gap-7 py-7 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {padded.map((cell, index) => (
                <button
                  key={cell.date}
                  type="button"
                  disabled={cell.empty}
                  onClick={() => setSelectedDay(index === selectedDay ? null : index)}
                  className="aspect-square rounded-[12px] border border-white/[0.04] transition-transform active:scale-95 disabled:pointer-events-none"
                  style={{
                    background: cell.empty
                      ? "rgba(255,255,255,0.018)"
                      : CELL_COLOURS[Math.max(0, Math.min(5, cell.colorIndex))],
                    boxShadow:
                      !cell.empty && cell.count > 0
                        ? `0 0 24px ${CELL_COLOURS[Math.max(0, Math.min(5, cell.colorIndex))]}`
                        : "none",
                    opacity: cell.empty ? 0.3 : cell.count > 0 ? 1 : 0.45,
                    outline: selectedDay === index ? "2px solid rgba(255,255,255,.65)" : "none",
                    outlineOffset: "2px",
                  }}
                  aria-label={cell.empty ? undefined : `${cell.dayLabel}: ${cell.label}, ${cell.count} observations`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 text-center text-[0.58rem] uppercase tracking-[0.08em] text-text-muted">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="font-display text-[clamp(3.7rem,8vw,6.4rem)] font-light leading-[.82] tracking-[-.04em] text-text-primary">
              {reading.label}
            </p>
            <p className="mt-4 text-[0.62rem] uppercase tracking-[0.16em] text-text-muted">current reading</p>
            <p className="mt-6 text-[2rem] font-light text-text-primary">{reading.observationCount}</p>
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">observations · 28 days</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/[0.055] pt-5 md:grid-cols-6">
          {reading.distribution.map((item, index) => (
            <div key={item.label}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.56rem] uppercase tracking-[0.09em] text-text-muted">{item.label}</span>
                <span className="text-[0.68rem] text-text-secondary">{item.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, item.pct)}%`, background: CELL_COLOURS[index] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="flex min-h-[420px] flex-col gap-4">
        {selected && !selected.empty ? (
          <div className="rounded-[30px] border border-white/[0.06] bg-white/[0.025] p-5">
            <p className="text-[0.58rem] uppercase tracking-[0.14em] text-cool-1">{selected.date}</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <h2 className="font-display text-[2.25rem] font-light text-text-primary">{selected.label}</h2>
              <span className="text-[0.7rem] text-text-muted">{selected.count} noticed</span>
            </div>
            <div className="mt-4 space-y-3">
              {selected.observations.slice(0, 4).map((observation) => (
                <div key={observation.id} className="rounded-[18px] border border-white/[0.045] bg-black/10 p-3">
                  <p className="line-clamp-3 text-[0.72rem] leading-relaxed text-text-secondary">{observation.text}</p>
                  <p className="mt-2 text-[0.55rem] uppercase tracking-[0.1em] text-text-muted">{observation.author}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[30px] border border-white/[0.06] bg-white/[0.025] p-5">
            <p className="text-[0.58rem] uppercase tracking-[0.14em] text-cool-1">How to read it</p>
            <h2 className="mt-3 font-display text-[2.2rem] font-light leading-[.95] text-text-primary">A climate, not a score.</h2>
            <p className="mt-4 text-[0.78rem] leading-[1.6] text-text-secondary">
              Warm means energy or urgency. Cool means calm, reflection or uncertainty. Neither is better. Tap a day to inspect what contributed.
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 rounded-[30px] border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[0.58rem] uppercase tracking-[0.14em] text-warm-3">Changing now</p>
          <div className="mt-3 space-y-2">
            {changing.slice(0, 4).map((signal) => (
              <button
                key={signal.id}
                type="button"
                onClick={() => onOpenSignal(signal.id)}
                className="w-full rounded-[18px] p-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-[1.25rem] font-light leading-[1.05] text-text-primary">{signal.title}</span>
                  <span className="shrink-0 text-[0.6rem] text-cool-1">{signal.direction === "new" ? "✦" : "↑"}</span>
                </div>
                <p className="mt-2 text-[0.56rem] uppercase tracking-[0.1em] text-text-muted">{signal.observationCount} observations</p>
              </button>
            ))}
            {!changing.length ? <p className="py-4 text-[0.72rem] text-text-muted">Nothing is sharply changing right now.</p> : null}
          </div>
        </div>
      </aside>
    </section>
  );
}

function HorizonView({
  signals,
  onOpenSignal,
}: {
  signals: SwellsSwellReading[];
  onOpenSignal: (signalId: string) => void;
}) {
  if (!signals.length) {
    return (
      <section className="grid min-h-[520px] place-items-center rounded-[36px] border border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-xl text-center">
          <p className="font-display text-5xl font-light">The horizon is quiet.</p>
          <p className="mt-4 text-text-muted">Signals will appear as observations begin to form patterns.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-0 overflow-y-auto pb-4">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.16em] text-cool-1">Living horizon</p>
          <h2 className="mt-2 font-display text-[clamp(2.6rem,5vw,4.7rem)] font-light leading-[.9] text-text-primary">What is forming?</h2>
        </div>
        <p className="max-w-md text-right text-[0.72rem] leading-relaxed text-text-muted">
          More than one swell can be visible here. Size, direction and evidence help you decide what deserves a closer look.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.slice(0, 9).map((signal, index) => (
          <button
            key={signal.id}
            type="button"
            onClick={() => onOpenSignal(signal.id)}
            className={`group flex min-h-[300px] flex-col overflow-hidden rounded-[32px] border p-5 text-left transition-transform active:scale-[.99] ${
              index === 0 ? "border-cool-1/20 bg-cool-1/[0.045] md:col-span-2" : "border-white/[0.06] bg-white/[0.025]"
            }`}
          >
            <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.13em]">
              <span className="text-cool-1">{directionLabel(signal.direction)}</span>
              <span className="text-text-muted">{strengthLabel(signal.strength)}</span>
            </div>
            <h3 className={`mt-5 font-display font-light leading-[.94] text-text-primary ${index === 0 ? "text-[clamp(2.5rem,5vw,4.8rem)]" : "text-[clamp(1.9rem,3vw,3rem)]"}`}>
              {signal.title}
            </h3>
            <div className="my-auto"><MiniWave signal={signal} /></div>
            <div className="border-t border-white/[0.05] pt-4">
              <p className="line-clamp-2 text-[0.74rem] leading-relaxed text-text-secondary">{signal.description || "A pattern is forming across recent observations."}</p>
              <div className="mt-3 flex gap-4 text-[0.56rem] uppercase tracking-[0.1em] text-text-muted">
                <span>{signal.observationCount} observations</span>
                <span>{signal.contributorCount} voices</span>
                <span className="ml-auto text-cool-1">Explore →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ExploreView({
  projection,
  selectedSignalId,
  onSelectSignal,
  observations,
  signalObservationMap,
  signalHistory,
}: {
  projection: SwellsSurfaceProjection;
  selectedSignalId: string | null;
  onSelectSignal: (id: string) => void;
  observations: ObservationView[];
  signalObservationMap: Record<string, string[]>;
  signalHistory: SignalHistoryItem[];
}) {
  const selected =
    projection.swells.find((signal) => signal.id === selectedSignalId) ??
    projection.swells[0] ??
    null;

  const observationById = useMemo(
    () => new Map(observations.map((observation) => [observation.id, observation])),
    [observations],
  );

  const selectedObservationIds = selected ? signalObservationMap[selected.id] ?? [] : [];
  const selectedEvidence = selectedObservationIds
    .map((id) => observationById.get(id))
    .filter((item): item is ObservationView => Boolean(item));

  const related = useMemo(() => {
    if (!selected) return [];
    const selectedSet = new Set(signalObservationMap[selected.id] ?? []);
    return projection.swells
      .filter((signal) => signal.id !== selected.id)
      .map((signal) => ({
        signal,
        overlap: (signalObservationMap[signal.id] ?? []).filter((id) => selectedSet.has(id)).length,
      }))
      .filter((item) => item.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap);
  }, [projection.swells, selected, signalObservationMap]);

  const history = selected
    ? signalHistory
        .filter((item) => item.signalId === selected.id)
        .sort((a, b) => a.snapshotAt.localeCompare(b.snapshotAt))
        .slice(-8)
    : [];

  return (
    <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
      <div className="flex min-h-[620px] flex-col rounded-[36px] border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.58rem] uppercase tracking-[0.14em] text-cool-1">Connected swells</p>
            <h2 className="mt-2 font-display text-[2.5rem] font-light leading-none text-text-primary">The field</h2>
          </div>
          <p className="max-w-xs text-right text-[0.66rem] leading-relaxed text-text-muted">Tap a swell. Lines show direct shared evidence where it exists.</p>
        </div>

        <div className="relative mt-4 min-h-[430px] flex-1 overflow-hidden rounded-[28px] border border-white/[0.04] bg-black/10">
          <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 50%, rgba(78,205,196,.12), transparent 52%)" }} />
          {selected ? (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {related.map(({ signal }) => {
                const fromIndex = Math.max(0, projection.swells.findIndex((item) => item.id === selected.id));
                const toIndex = Math.max(0, projection.swells.findIndex((item) => item.id === signal.id));
                const [x1, y1] = NODE_POSITIONS[fromIndex % NODE_POSITIONS.length];
                const [x2, y2] = NODE_POSITIONS[toIndex % NODE_POSITIONS.length];
                return <line key={signal.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(78,205,196,.28)" strokeWidth=".35" />;
              })}
            </svg>
          ) : null}

          {projection.swells.slice(0, 10).map((signal, index) => {
            const [x, y] = NODE_POSITIONS[index % NODE_POSITIONS.length];
            const active = selected?.id === signal.id;
            const size = signal.strength === "strong" ? 126 : signal.strength === "emerging" ? 105 : 88;
            return (
              <button
                key={signal.id}
                type="button"
                onClick={() => onSelectSignal(signal.id)}
                className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border p-3 text-center transition-all ${active ? "z-20 border-cool-1/45 bg-cool-1/15 shadow-[0_0_55px_rgba(78,205,196,.18)]" : "z-10 border-white/[0.08] bg-[#111827]/90"}`}
                style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
              >
                <span className="line-clamp-3 font-display text-[clamp(.85rem,1.5vw,1.2rem)] font-light leading-[1.02] text-text-primary">{signal.title}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex min-h-[44px] flex-wrap items-center gap-2">
          {related.length ? related.slice(0, 4).map(({ signal, overlap }) => (
            <button key={signal.id} type="button" onClick={() => onSelectSignal(signal.id)} className="rounded-full border border-white/[0.06] px-3 py-2 text-[0.6rem] text-text-secondary">
              {signal.title} · {overlap} shared
            </button>
          )) : <p className="text-[0.66rem] text-text-muted">No direct shared-evidence connections for this swell yet.</p>}
        </div>
      </div>

      {selected ? (
        <aside className="min-h-0 overflow-y-auto rounded-[36px] border border-white/[0.06] bg-white/[0.025] p-5 md:p-6">
          <div className="flex items-center justify-between gap-4 text-[0.58rem] uppercase tracking-[0.13em]">
            <span className="text-cool-1">{directionLabel(selected.direction)}</span>
            <span className="text-text-muted">{strengthLabel(selected.strength)}</span>
          </div>
          <h2 className="mt-4 font-display text-[clamp(2.5rem,4vw,4.2rem)] font-light leading-[.92] text-text-primary">{selected.title}</h2>
          <p className="mt-4 text-[0.78rem] leading-[1.6] text-text-secondary">{selected.description || "A pattern emerging across observations in this space."}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[['evidence', selected.observationCount], ['voices', selected.contributorCount], ['history', history.length]].map(([label, value]) => (
              <div key={String(label)} className="rounded-[18px] border border-white/[0.05] bg-black/10 p-3">
                <p className="text-[1.35rem] font-light text-text-primary">{value}</p>
                <p className="mt-1 text-[0.54rem] uppercase tracking-[0.09em] text-text-muted">{label}</p>
              </div>
            ))}
          </div>

          {history.length ? (
            <div className="mt-5 rounded-[22px] border border-white/[0.05] p-4">
              <p className="text-[0.56rem] uppercase tracking-[0.11em] text-text-muted">Visual history</p>
              <div className="mt-3 flex items-end gap-2">
                {history.map((item) => {
                  const height = item.strength === "strong" ? 42 : item.strength === "emerging" ? 30 : 18;
                  return (
                    <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
                      <div className="w-full max-w-8 rounded-full bg-cool-1/55" style={{ height }} />
                      <span className="text-[0.5rem] text-text-muted">{item.direction === "strengthening" ? "↑" : item.direction === "new" ? "✦" : "→"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">Evidence</p>
              <span className="text-[0.6rem] text-text-muted">{selectedEvidence.length} linked</span>
            </div>
            <div className="space-y-2">
              {selectedEvidence.slice(0, 8).map((observation) => (
                <article key={observation.id} className="rounded-[20px] border border-white/[0.05] bg-black/10 p-4">
                  <p className="line-clamp-4 text-[0.72rem] leading-[1.55] text-text-secondary">{observation.text}</p>
                  <div className="mt-3 flex items-center justify-between text-[0.54rem] uppercase tracking-[0.09em] text-text-muted">
                    <span>{observation.author}</span>
                    <span>{observation.sentimentTier ?? observation.time}</span>
                  </div>
                </article>
              ))}
              {!selectedEvidence.length ? <p className="rounded-[20px] border border-white/[0.04] p-4 text-[0.7rem] text-text-muted">No linked observation is available to inspect yet.</p> : null}
            </div>
          </div>

          <div className="mt-5">
            <TabletAskPanel spaceId={projection.spaceId} signal={selected} />
          </div>
        </aside>
      ) : null}
    </section>
  );
}

export function TabletSwellsSurface({
  projection,
  spaceName,
  spaces,
  observations,
  signalObservationMap,
  signalHistory,
  canCapture,
}: {
  projection: SwellsSurfaceProjection;
  spaceName: string;
  spaces: Array<{ id: string; name: string }>;
  observations: ObservationView[];
  signalObservationMap: Record<string, string[]>;
  signalHistory: SignalHistoryItem[];
  canCapture: boolean;
}) {
  const [lens, setLens] = useState<TabletLens>("temperature");
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(projection.swells[0]?.id ?? null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const router = useRouter();

  function chooseSpace(spaceId: string) {
    document.cookie = `swells-tablet-space=${spaceId}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(`/tablet/${spaceId}`);
  }

  function openSignal(signalId: string) {
    setSelectedSignalId(signalId);
    setLens("explore");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-deep px-4 pb-5 pt-4 text-text-primary md:px-6 md:pb-6 md:pt-5">
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/[0.045] bg-white/[0.015] px-4 py-3">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-[2rem] font-light tracking-[-.035em]">swells</span>
          <span className="hidden text-[0.58rem] uppercase tracking-[0.16em] text-text-muted sm:inline">sensemaking table</span>
        </div>

        <nav className="order-3 flex w-full rounded-full border border-white/[0.06] bg-black/10 p-1 sm:order-none sm:w-auto" aria-label="Swells tablet views">
          {([
            ["temperature", "Temperature"],
            ["horizon", "Horizon"],
            ["explore", "Explore"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setLens(id)} className={`min-w-0 flex-1 rounded-full px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.1em] transition-colors sm:flex-none ${lens === id ? "bg-white/[0.1] text-text-primary" : "text-text-muted"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {canCapture ? (
            <button type="button" onClick={() => setNoticeOpen(true)} className="rounded-full border border-warm-3/20 bg-warm-3/8 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.1em] text-warm-3">
              + Notice
            </button>
          ) : null}
          <label className="sr-only" htmlFor="tablet-space">Space</label>
          <select id="tablet-space" value={projection.spaceId} onChange={(event) => chooseSpace(event.target.value)} className="max-w-[230px] rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[0.66rem] text-text-secondary outline-none">
            {spaces.map((space) => <option key={space.id} value={space.id} className="bg-deep">{space.name}</option>)}
          </select>
        </div>
      </header>

      <div className="mb-4 flex shrink-0 items-end justify-between gap-5 border-b border-white/[0.05] px-1 pb-4">
        <div>
          <p className="text-[0.54rem] uppercase tracking-[0.16em] text-text-muted">Space</p>
          <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,3rem)] font-light leading-none">{spaceName}</h1>
        </div>
        <p className="hidden max-w-md text-right text-[0.68rem] leading-relaxed text-text-muted md:block">
          Same observations and swells. More room to see relationships, history and evidence.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {lens === "temperature" ? (
          <TemperatureView projection={projection} onOpenSignal={openSignal} />
        ) : lens === "horizon" ? (
          <HorizonView signals={projection.swells} onOpenSignal={openSignal} />
        ) : (
          <ExploreView
            projection={projection}
            selectedSignalId={selectedSignalId}
            onSelectSignal={setSelectedSignalId}
            observations={observations}
            signalObservationMap={signalObservationMap}
            signalHistory={signalHistory}
          />
        )}
      </div>

      {noticeOpen ? <TabletNoticeComposer spaceId={projection.spaceId} onClose={() => setNoticeOpen(false)} /> : null}
    </main>
  );
}
