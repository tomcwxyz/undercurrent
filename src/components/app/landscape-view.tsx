"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import { FilterChip } from "@/components/app/filter-chip";
import { SourceFilter, matchesSource, type SourceFilterValue } from "@/components/app/source-filter";
import type { SignalView, ObservationView, SignalObservationMaps, CollectionView, LandscapeTerrainLayer } from "@/lib/types";

const DIRECTION_LABELS = {
  strengthening: { label: "↑ Strengthening", cls: "bg-cool-1/12 text-cool-1" },
  steady: { label: "→ Steady", cls: "bg-warm-3/12 text-warm-3" },
  new: { label: "✦ New", cls: "bg-cool-3/12 text-cool-3" },
} as const;

const STRENGTH_FILTERS = ["All", "Strong", "Emerging", "Weak"] as const;
const DIRECTION_FILTERS = ["All", "Strengthening", "Steady", "New"] as const;

interface LandscapeViewProps {
  signals: SignalView[];
  observations?: ObservationView[];
  signalObservationMaps?: SignalObservationMaps;
  onNavigateToObservation?: (id: string) => void;
  collections?: CollectionView[];
  terrain?: LandscapeTerrainLayer[];
}

export function LandscapeView({ signals, observations, signalObservationMaps, onNavigateToObservation, collections, terrain }: LandscapeViewProps) {
  const [search, setSearch] = useState("");
  const [strengthFilter, setStrengthFilter] = useState<string>("All");
  const [directionFilter, setDirectionFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);

  const observationById = useMemo(() => {
    if (!observations) return new Map<string, ObservationView>();
    return new Map(observations.map((o) => [o.id, o]));
  }, [observations]);

  const hasReflections = useMemo(
    () => (observations ?? []).some((o) => o.reflectionId),
    [observations]
  );

  const filtered = useMemo(() => {
    let result = signals;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    if (strengthFilter !== "All") {
      const key = strengthFilter.toLowerCase();
      result = result.filter((s) => s.strength === key);
    }

    if (directionFilter !== "All") {
      const key = directionFilter.toLowerCase();
      result = result.filter((s) => s.direction === key);
    }

    // Keep signals that have at least one linked observation matching the source
    if (sourceFilter !== "all") {
      result = result.filter((s) => {
        const obsIds = signalObservationMaps?.bySignal[s.id] ?? [];
        return obsIds.some((id) => {
          const obs = observationById.get(id);
          return obs ? matchesSource(obs, sourceFilter) : false;
        });
      });
    }

    return result;
  }, [signals, search, strengthFilter, directionFilter, sourceFilter, signalObservationMaps, observationById]);

  const isFiltered = search || strengthFilter !== "All" || directionFilter !== "All" || sourceFilter !== "all";

  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light">
          Signal landscape
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          The terrain of what your organisation is sensing — your most common
          themes rising and falling across the last 30 days.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mx-auto mb-6 max-w-[1100px]">
        {/* Mobile: toggle button */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="mb-3 flex items-center gap-2 text-[0.8rem] text-text-secondary transition-colors hover:text-text-primary md:hidden"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <label htmlFor="landscape-search" className="sr-only">Search signals</label>
            <input
              id="landscape-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signals..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-4 text-[0.85rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
            />
          </div>

          {/* Strength chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="mr-1 self-center text-[0.7rem] text-text-secondary">Strength:</span>
            {STRENGTH_FILTERS.map((f) => (
              <FilterChip
                key={f}
                label={f}
                active={strengthFilter === f}
                onClick={() => setStrengthFilter(f)}
              />
            ))}
          </div>

          {/* Direction chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="mr-1 self-center text-[0.7rem] text-text-secondary">Direction:</span>
            {DIRECTION_FILTERS.map((f) => (
              <FilterChip
                key={f}
                label={f}
                active={directionFilter === f}
                onClick={() => setDirectionFilter(f)}
              />
            ))}
          </div>

          {/* Source dropdown (shown when collections or reflections exist) */}
          {((collections && collections.length > 0) || hasReflections) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SourceFilter
                collections={collections ?? []}
                hasReflections={hasReflections}
                value={sourceFilter}
                onChange={setSourceFilter}
              />
            </div>
          )}
        </div>

        {/* Filtered count */}
        {isFiltered && (
          <div aria-live="polite" className="mt-3 text-center text-[0.78rem] text-text-muted">
            Showing {filtered.length} of {signals.length}
          </div>
        )}
      </div>

      <TerrainCanvas layers={terrain ?? []} />

      <div className="mx-auto mt-8 grid max-w-[1100px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((signal) => {
          const color = SIGNAL_COLORS[signal.strength];
          const dir = DIRECTION_LABELS[signal.direction];
          const pct =
            signal.strength === "strong"
              ? 85
              : signal.strength === "emerging"
                ? 60
                : 30;
          const isExpanded = expandedSignalId === signal.id;
          const linkedObsIds = signalObservationMaps?.bySignal[signal.id] ?? [];

          return (
            <div
              key={signal.id}
              className={`group cursor-pointer overflow-hidden rounded-2xl border bg-card p-6 transition-all hover:bg-card-hover hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)] ${
                isExpanded ? "border-cool-1/20" : "border-white/[0.04] hover:-translate-y-0.5"
              }`}
              onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
            >
              {/* Strength + Direction row */}
              <div className="mb-3.5 flex items-center gap-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/[0.06]">
                  <div
                    className="h-full rounded-sm transition-all duration-1000"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color.css}, color-mix(in srgb, ${color.css} 60%, transparent))`,
                    }}
                  />
                </div>
                <span className="whitespace-nowrap text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
                  {signal.strength}
                </span>
                <span className={`rounded-lg px-2 py-0.5 text-[0.7rem] font-medium ${dir.cls}`}>
                  {dir.label}
                </span>
              </div>

              <h3 className="font-display text-[1.2rem] font-normal leading-snug">
                {signal.title}
              </h3>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-text-secondary">
                {signal.description}
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] text-text-muted">
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(7, signal.observationCount) }).map((_, j) => (
                    <span
                      key={j}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          j < 3
                            ? color.css
                            : j < 5
                              ? "color-mix(in srgb, var(--color-cool-1) 50%, transparent)"
                              : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>
                {signal.observationCount} observations · {signal.contributorCount} people
                <svg
                  aria-hidden="true"
                  className={`ml-auto h-4 w-4 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              {/* Expanded observation snippets */}
              {isExpanded && (
                <div
                  className="mt-4 space-y-2 border-t border-white/[0.06] pt-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {linkedObsIds.length === 0 ? (
                    <p className="text-[0.78rem] text-text-muted">No linked observations yet</p>
                  ) : (
                    linkedObsIds.map((obsId) => {
                      const obs = observationById.get(obsId);
                      if (!obs) return null;
                      return (
                        <button
                          key={obsId}
                          className="group/snippet flex w-full items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-left transition-all hover:border-white/8 hover:bg-white/[0.04]"
                          onClick={() => onNavigateToObservation?.(obsId)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.72rem] text-text-muted">
                              {obs.author} · {obs.time}
                            </div>
                            <div className="mt-0.5 text-[0.85rem] leading-relaxed text-text-primary line-clamp-2">
                              {obs.text === "[Extracting from image\u2026]" ? (
                                <span className="italic text-text-muted">Extracting text from image\u2026</span>
                              ) : (
                                obs.text
                              )}
                            </div>
                          </div>
                          {onNavigateToObservation && (
                            <span className="mt-1 shrink-0 text-[0.85rem] text-text-muted opacity-0 transition-opacity group-hover/snippet:opacity-100">
                              &rarr;
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAYS = 30;
const PADDING = 40;
const TIME_LABELS = ["4 weeks ago", "3 weeks ago", "2 weeks ago", "Last week", "Now"];

/**
 * Stacked-area "terrain" of theme activity over the trailing 30 days. Each band
 * is a recurring theme; its height on a given day is the number of observations
 * carrying that theme. Driven entirely by real data (see toLandscapeTerrain).
 */
function TerrainCanvas({ layers }: { layers: LandscapeTerrainLayer[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<LandscapeTerrainLayer[]>(layers);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    canvasW: number;
    day: number;
    layers: { label: string; color: string; value: number }[];
  } | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const draw = useCallback((highlightDay: number | null = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const plotW = w - PADDING * 2;
    const plotH = h - PADDING * 2;
    const baseY = h - PADDING;
    const terrain = layersRef.current;

    // Scale to the busiest day's stacked total (with headroom) so sparse and
    // dense spaces both fill the chart sensibly.
    let peak = 1;
    for (let i = 0; i < DAYS; i++) {
      let stack = 0;
      for (const ly of terrain) stack += ly.data[i] ?? 0;
      if (stack > peak) peak = stack;
    }
    const scaleTop = peak * 1.15;
    const stackAt = (upto: number, day: number) => {
      let sum = 0;
      for (let l = 0; l <= upto; l++) sum += terrain[l].data[day] ?? 0;
      return sum;
    };

    // Read text color from CSS token
    const styles = getComputedStyle(document.documentElement);
    const mutedHex = styles.getPropertyValue("--color-text-muted").trim() || "#8b8fa4";
    const mr = parseInt(mutedHex.slice(1, 3), 16);
    const mg = parseInt(mutedHex.slice(3, 5), 16);
    const mb = parseInt(mutedHex.slice(5, 7), 16);

    // Draw stacked area
    for (let l = terrain.length - 1; l >= 0; l--) {
      const layer = terrain[l];
      ctx.beginPath();
      ctx.moveTo(PADDING, baseY);

      for (let i = 0; i < DAYS; i++) {
        const x = PADDING + (i / (DAYS - 1)) * plotW;
        const y = baseY - (stackAt(l, i) / scaleTop) * plotH;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevX = PADDING + ((i - 1) / (DAYS - 1)) * plotW;
          const prevY = baseY - (stackAt(l, i - 1) / scaleTop) * plotH;
          const cpx = (prevX + x) / 2;
          ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
        }
      }

      ctx.lineTo(PADDING + plotW, baseY);
      ctx.closePath();

      const isHighlighted = highlightDay === null;
      const grad = ctx.createLinearGradient(0, PADDING, 0, baseY);
      grad.addColorStop(0, `rgba(${layer.color},${isHighlighted ? 0.5 : 0.35})`);
      grad.addColorStop(1, `rgba(${layer.color},${isHighlighted ? 0.05 : 0.02})`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `rgba(${layer.color},${isHighlighted ? 0.4 : 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Vertical hover line + dots
    if (highlightDay !== null && highlightDay >= 0 && highlightDay < DAYS) {
      const x = PADDING + (highlightDay / (DAYS - 1)) * plotW;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, baseY);
      const primaryHex = styles.getPropertyValue("--color-text-primary").trim() || "#e8e4df";
      const pr = parseInt(primaryHex.slice(1, 3), 16);
      const pg = parseInt(primaryHex.slice(3, 5), 16);
      const pb = parseInt(primaryHex.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${pr},${pg},${pb},0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dots at each layer boundary
      for (let l = 0; l < terrain.length; l++) {
        const y = baseY - (stackAt(l, highlightDay) / scaleTop) * plotH;
        const c = terrain[l].color;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c},0.9)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c},0.4)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Time labels
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillStyle = `rgba(${mr},${mg},${mb},0.9)`;
    ctx.textAlign = "center";
    TIME_LABELS.forEach((label, i, arr) => {
      ctx.fillText(label, PADDING + (i / (arr.length - 1)) * plotW, h - 12);
    });
  }, []);

  // Keep the ref in sync with the latest data and redraw.
  useEffect(() => {
    layersRef.current = layers;
    draw(hoveredDay);
  }, [layers, draw, hoveredDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => draw(hoveredDay), 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimeout);
    };
  }, [draw, hoveredDay]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvas.offsetWidth;
    const plotW = w - PADDING * 2;

    const dayFloat = ((mx - PADDING) / plotW) * (DAYS - 1);
    const day = Math.round(dayFloat);

    if (day < 0 || day >= DAYS || mx < PADDING || mx > w - PADDING) {
      setTooltip(null);
      setHoveredDay(null);
      return;
    }

    const layerValues = layersRef.current.map((l) => ({
      label: l.label,
      color: l.color,
      value: Math.round(l.data[day] ?? 0),
    }));

    setHoveredDay(day);
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      canvasW: w,
      day,
      layers: layerValues,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
    setHoveredDay(null);
  }

  // No themes yet → honest empty state instead of a fabricated terrain.
  if (layers.length === 0) {
    return (
      <div className="mx-auto flex h-[220px] max-w-[1100px] items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.015] md:h-[300px]">
        <p className="max-w-[360px] px-6 text-center text-[0.85rem] leading-relaxed text-text-muted">
          The landscape forms here as themes emerge across your observations. Add a
          few observations and the terrain will start to take shape.
        </p>
      </div>
    );
  }

  const weeksAgo = tooltip ? Math.floor((DAYS - 1 - tooltip.day) / 7) : 0;
  const dayLabel = tooltip
    ? tooltip.day === DAYS - 1
      ? "Today"
      : weeksAgo === 0
        ? `${DAYS - 1 - tooltip.day} days ago`
        : `~${weeksAgo} week${weeksAgo > 1 ? "s" : ""} ago`
    : "";

  return (
    <div className="relative mx-auto max-w-[1100px]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Theme activity over the last 30 days"
        className="h-[220px] w-full cursor-crosshair rounded-2xl md:h-[300px]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 min-w-[180px] rounded-xl border border-white/8 p-3.5 text-[0.78rem] backdrop-blur-2xl"
          style={{
            left: Math.min(tooltip.x + 16, tooltip.canvasW - 210),
            top: Math.max(tooltip.y - 20, 8),
            background: "rgba(20,27,45,0.92)",
          }}
        >
          <div className="mb-2 text-[0.72rem] font-medium text-text-secondary">
            {dayLabel}
          </div>
          <div className="flex flex-col gap-1.5">
            {tooltip.layers.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: `rgb(${l.color})` }}
                  />
                  <span className="text-text-secondary">{l.label}</span>
                </div>
                <span className="font-medium text-text-primary">{l.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend below chart — the actual themes driving the terrain */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[0.72rem] text-text-muted">
        {layers.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: `rgb(${l.color})` }}
            />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
