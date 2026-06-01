"use client";

import { useState, useMemo } from "react";
import type { SentimentViewData, SentimentCell, ObservationSnippet } from "@/lib/types";
import { SENTIMENT_TIERS } from "@/lib/db/transforms";

const WARM_COLORS = [
  "rgba(108, 92, 231, 0.3)",  // cool/reflective
  "rgba(69, 183, 209, 0.4)",  // uncertain
  "rgba(78, 205, 196, 0.4)",  // calm
  "rgba(255, 209, 102, 0.4)", // warm
  "rgba(255, 140, 66, 0.5)",  // energised
  "rgba(255, 107, 74, 0.6)",  // urgent/hot
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const INSIGHT_GRADIENTS: Record<string, string> = {
  hot: "linear-gradient(90deg, var(--color-warm-1), var(--color-warm-2))",
  building: "linear-gradient(90deg, var(--color-warm-3), var(--color-cool-1))",
  cool: "linear-gradient(90deg, var(--color-cool-2), var(--color-cool-3))",
};

// Distribution bar colors map from sentiment tier to CSS color
const DIST_COLORS = [
  "var(--color-cool-3)",  // Quiet
  "var(--color-cool-2)",  // Reflective
  "var(--color-cool-1)",  // Calm
  "var(--color-warm-3)",  // Warm
  "var(--color-warm-2)",  // Energised
  "var(--color-warm-1)",  // Urgent
];

/** Unified cell type for rendering both daily and weekly grids */
interface DisplayCell {
  color: string;
  label: string;
  count: number;
  colorIndex: number;
  bottomLabel: string; // "Mon"..."Sun" for daily, "3–9 Feb" for weekly
  dateHeading: string; // Human-readable heading for detail panel
  observations: ObservationSnippet[];
  isReal: boolean;
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Build daily DisplayCells from SentimentCell array */
function buildDailyCells(cells: SentimentCell[]): DisplayCell[] {
  return cells.map((cell) => ({
    color: WARM_COLORS[cell.colorIndex],
    label: cell.label,
    count: cell.count,
    colorIndex: cell.colorIndex,
    bottomLabel: cell.dayLabel,
    dateHeading: formatDateHeading(cell.date),
    observations: cell.observations,
    isReal: true,
  }));
}

/** Group daily DisplayCells into 4 weekly DisplayCells */
function aggregateWeekly(dailyCells: DisplayCell[]): DisplayCell[] {
  const weeks: DisplayCell[] = [];
  for (let w = 0; w < 4; w++) {
    const chunk = dailyCells.slice(w * 7, (w + 1) * 7);
    if (chunk.length === 0) continue;

    let totalCount = 0;
    let weightedSum = 0;
    const allObs: ObservationSnippet[] = [];

    for (const c of chunk) {
      totalCount += c.count;
      if (c.count > 0) weightedSum += c.colorIndex * c.count;
      allObs.push(...c.observations);
    }

    const avgIndex = totalCount > 0 ? Math.round(weightedSum / totalCount) : 0;
    const clamped = Math.max(0, Math.min(5, avgIndex));

    // Date range label
    const firstHeading = chunk[0].dateHeading;
    const lastHeading = chunk[chunk.length - 1].dateHeading;
    // Extract just day + month for compact label: "3–9 Feb"
    const firstDate = firstHeading.replace(/^\w+,?\s*/, ""); // strip weekday
    const lastDate = lastHeading.replace(/^\w+,?\s*/, "");

    weeks.push({
      color: WARM_COLORS[clamped],
      label: SENTIMENT_TIERS[clamped],
      count: totalCount,
      colorIndex: clamped,
      bottomLabel: `Week ${w + 1}`,
      dateHeading: `${firstDate} – ${lastDate}`,
      observations: allObs,
      isReal: chunk[0].isReal,
    });
  }
  return weeks;
}

interface SentimentViewProps {
  data: SentimentViewData;
  onNavigateToObservation?: (id: string) => void;
}

export function SentimentView({ data, onNavigateToObservation }: SentimentViewProps) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [aggregation, setAggregation] = useState<"daily" | "weekly">("daily");
  // selectedGrid tracks which grid the selection is in (for compare mode)
  const [selectedGrid, setSelectedGrid] = useState<"current" | "comparison">("current");

  const dailyCells = useMemo(() => buildDailyCells(data.cells), [data.cells]);

  const weeklyCells = useMemo(() => aggregateWeekly(dailyCells), [dailyCells]);

  const cells = aggregation === "weekly" ? weeklyCells : dailyCells;
  const isWeekly = aggregation === "weekly";

  // --- Comparison mode ---
  const [comparing, setComparing] = useState(false);
  const hasComparison = !!data.comparison;

  const comparisonDaily = useMemo(() => {
    if (!data.comparison) return [];
    return buildDailyCells(data.comparison.cells);
  }, [data.comparison]);

  const comparisonWeekly = useMemo(
    () => aggregateWeekly(comparisonDaily),
    [comparisonDaily]
  );

  const comparisonCells = aggregation === "weekly" ? comparisonWeekly : comparisonDaily;

  const comparisonBar = useMemo(() => {
    if (!data.comparison) return [];
    return [...data.comparison.distribution]
      .map((d, i) => ({ pct: d.pct, color: DIST_COLORS[i], opacity: 0.7 }))
      .reverse()
      .filter((seg) => seg.pct > 0);
  }, [data.comparison]);

  // Delta summary between current and comparison periods
  const delta = useMemo(() => {
    if (!data.comparison) return null;
    const countDiff = data.totalObservations - data.comparison.totalObservations;
    const countText =
      countDiff > 0
        ? `\u2191 ${countDiff} more observation${countDiff !== 1 ? "s" : ""}`
        : countDiff < 0
          ? `\u2193 ${Math.abs(countDiff)} fewer observation${Math.abs(countDiff) !== 1 ? "s" : ""}`
          : "Same number of observations";

    // Average colorIndex for sentiment shift
    const avgCurrent =
      cells.length > 0
        ? cells.reduce((s, c) => s + c.colorIndex * c.count, 0) /
          Math.max(1, cells.reduce((s, c) => s + c.count, 0))
        : 0;
    const avgPrev =
      comparisonCells.length > 0
        ? comparisonCells.reduce((s, c) => s + c.colorIndex * c.count, 0) /
          Math.max(1, comparisonCells.reduce((s, c) => s + c.count, 0))
        : 0;
    const shift = avgCurrent - avgPrev;
    const shiftText =
      shift > 0.3
        ? "Warmer overall"
        : shift < -0.3
          ? "Cooler overall"
          : "Similar temperature";

    return { countText, shiftText };
  }, [data.totalObservations, data.comparison, cells, comparisonCells]);

  // Clear selection when switching aggregation or toggling compare
  const handleAggregationChange = (mode: "daily" | "weekly") => {
    setSelectedCell(null);
    setAggregation(mode);
  };

  const handleCompareToggle = () => {
    setSelectedCell(null);
    setComparing((prev) => !prev);
  };

  // Selected cell data for detail panel (works for both grids)
  const selectedCellData =
    selectedCell !== null
      ? selectedGrid === "current"
        ? cells[selectedCell] ?? null
        : comparing
          ? comparisonCells[selectedCell] ?? null
          : null
      : null;

  // Distribution bar segments
  const barSegments = useMemo(() => {
    return [...data.distribution]
      .map((d, i) => ({ pct: d.pct, color: DIST_COLORS[i], opacity: 0.7 }))
      .reverse()
      .filter((seg) => seg.pct > 0);
  }, [data.distribution]);

  // Insight cards
  const insightCards = data.insights.map((insight) => ({
    gradient: INSIGHT_GRADIENTS[insight.bucket],
    title: insight.title,
    text: insight.text,
  }));

  const observationCount = data.totalObservations;

  function handleCellClick(index: number, grid: "current" | "comparison" = "current") {
    setSelectedGrid(grid);
    setSelectedCell((prev) => (prev === index && selectedGrid === grid ? null : index));
  }

  // Column labels for the bottom row
  const bottomLabels = isWeekly
    ? cells.map((c) => c.bottomLabel)
    : DAY_LABELS;
  const gridCols = isWeekly ? "grid-cols-4" : "grid-cols-7";

  // No sentiment data yet → honest empty state rather than a fabricated heatmap.
  if (!data.hasData) {
    return (
      <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-display text-[2.2rem] font-light">The temperature of things</h2>
          <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
            Sentiment flowing through observations over time. Warm means energy,
            excitement, urgency. Cool means calm, reflective, uncertain. Neither
            is better.
          </p>
        </div>
        <div className="mx-auto flex max-w-[800px] items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.015] px-6 py-20 text-center">
          <p className="max-w-[380px] text-[0.9rem] leading-relaxed text-text-muted">
            No sentiment to show yet. As observations come in and are processed,
            their emotional temperature maps out here — day by day, warm to cool.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light">
          The temperature of things
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          Sentiment flowing through observations over time. Warm means energy,
          excitement, urgency. Cool means calm, reflective, uncertain. Neither
          is better.
        </p>
      </div>

      {/* Controls row */}
      <div className="mx-auto mb-4 flex max-w-[800px] items-center justify-between gap-2">
        <div /> {/* spacer for layout balance */}
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-white/[0.08] text-[0.72rem]">
            <button
              className={`px-3 py-1.5 transition-colors ${
                aggregation === "daily"
                  ? "bg-white/[0.08] text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              aria-pressed={aggregation === "daily"}
              onClick={() => handleAggregationChange("daily")}
            >
              Daily
            </button>
            <button
              className={`px-3 py-1.5 transition-colors ${
                aggregation === "weekly"
                  ? "bg-white/[0.08] text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              aria-pressed={aggregation === "weekly"}
              onClick={() => handleAggregationChange("weekly")}
            >
              Weekly
            </button>
          </div>
          <button
            className={`rounded-lg border px-3 py-1.5 text-[0.72rem] transition-colors ${
              comparing
                ? "border-white/[0.15] bg-white/[0.08] text-text-primary"
                : "border-white/[0.08] text-text-muted hover:text-text-secondary"
            }`}
            aria-pressed={comparing}
            onClick={handleCompareToggle}
          >
            Compare &harr;
          </button>
        </div>
      </div>

      {/* Current period grid */}
      <div className={`mx-auto max-w-[800px] ${isWeekly ? "pt-8" : "overflow-x-auto"}`}>
        {comparing && (
          <div className="mb-2 text-[0.72rem] text-text-muted">This month</div>
        )}
        <div className={`mb-2 grid ${isWeekly ? "" : "min-w-[480px]"} ${gridCols} gap-1`}>
          {cells.map((cell, i) => (
            <div
              key={i}
              className={`group relative rounded-[6px] transition-[transform,box-shadow] hover:z-10 hover:scale-[1.15] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ${
                isWeekly ? "h-24" : "aspect-square"
              } ${cell.isReal ? "cursor-pointer" : ""}`}
              style={{
                background: cell.color,
                outline: selectedCell === i && selectedGrid === "current"
                  ? "2px solid rgba(78,205,196,0.6)"
                  : "none",
                outlineOffset: "-1px",
              }}
              onClick={() => handleCellClick(i)}
            >
              <div
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary opacity-0 backdrop-blur-2xl transition-opacity group-hover:opacity-100"
                style={{ background: "rgba(20, 27, 45, 0.95)" }}
              >
                {cell.label} &middot; {cell.count} observations
              </div>
            </div>
          ))}
        </div>

        {/* Bottom labels */}
        <div className={`mb-2 grid ${isWeekly ? "" : "min-w-[480px]"} ${gridCols} gap-1 text-center text-[0.68rem] text-text-muted`}>
          {bottomLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>

      {/* Comparison: delta summary + previous grid */}
      {comparing && hasComparison && delta && (
        <div className="mx-auto max-w-[800px]">
          {/* Delta summary */}
          <div className="my-4 flex items-center justify-center gap-6 rounded-xl border border-white/[0.06] bg-card px-5 py-3 text-[0.78rem]">
            <span className="text-text-secondary">{delta.countText}</span>
            <span className="h-3 w-px bg-white/10" />
            <span className="text-text-secondary">{delta.shiftText}</span>
          </div>

          {/* Previous period grid */}
          <div className={isWeekly ? "pt-8" : "overflow-x-auto"}>
            <div className="mb-2 text-[0.72rem] text-text-muted">Previous month</div>
            <div className={`mb-2 grid ${isWeekly ? "" : "min-w-[480px]"} ${gridCols} gap-1`}>
              {comparisonCells.map((cell, i) => (
                <div
                  key={i}
                  className={`group relative cursor-pointer rounded-[6px] border border-white/[0.04] transition-[transform,box-shadow] hover:z-10 hover:scale-[1.15] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] ${
                    isWeekly ? "h-24" : "aspect-square"
                  }`}
                  style={{
                    background: cell.color,
                    outline: selectedCell === i && selectedGrid === "comparison"
                      ? "2px solid rgba(78,205,196,0.6)"
                      : "none",
                    outlineOffset: "-1px",
                  }}
                  onClick={() => handleCellClick(i, "comparison")}
                >
                  <div
                    className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary opacity-0 backdrop-blur-2xl transition-opacity group-hover:opacity-100"
                    style={{ background: "rgba(20, 27, 45, 0.95)" }}
                  >
                    {cell.label} &middot; {cell.count} observations
                  </div>
                </div>
              ))}
            </div>
            <div className={`mb-2 grid ${isWeekly ? "" : "min-w-[480px]"} ${gridCols} gap-1 text-center text-[0.68rem] text-text-muted`}>
              {(aggregation === "weekly" ? comparisonCells.map((c) => c.bottomLabel) : DAY_LABELS).map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compare active but no previous data */}
      {comparing && !hasComparison && (
        <div className="mx-auto mt-4 max-w-[800px] text-center text-[0.8rem] text-text-muted">
          Not enough data for previous period
        </div>
      )}

      {/* Detail panel */}
      {selectedCellData && selectedCellData.isReal && selectedCellData.count > 0 && (
        <div className="mx-auto mb-6 mt-4 max-w-[800px]" aria-live="polite">
          <div
            className="rounded-2xl border border-white/[0.06] bg-card p-5"
            style={{ animation: "fade-up 0.25s ease forwards" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ background: selectedCellData.color }}
                />
                <span className="text-[0.85rem] text-text-primary">
                  {selectedCellData.dateHeading}
                  {comparing && selectedGrid === "comparison" && (
                    <span className="ml-1 text-text-muted">(previous)</span>
                  )}
                </span>
                <span className="text-[0.78rem] text-text-muted">
                  {selectedCellData.label} &middot; {selectedCellData.count} observation{selectedCellData.count !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-[0.78rem] text-text-muted hover:text-text-secondary"
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              {selectedCellData.observations.map((snippet: ObservationSnippet) => (
                <button
                  key={snippet.id}
                  className="group/snippet flex w-full items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-left transition-all hover:border-white/8 hover:bg-white/[0.04]"
                  onClick={() => onNavigateToObservation?.(snippet.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.72rem] text-text-muted">
                      {snippet.author} &middot; {snippet.sentimentLabel}
                    </div>
                    <div className="mt-0.5 text-[0.85rem] leading-relaxed text-text-primary">
                      {snippet.text}
                    </div>
                  </div>
                  {onNavigateToObservation && (
                    <span className="mt-1 shrink-0 text-[0.85rem] text-text-muted opacity-0 transition-opacity group-hover/snippet:opacity-100">
                      &rarr;
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer when no detail panel */}
      {(!selectedCellData || !selectedCellData.isReal || selectedCellData.count === 0) && <div className="mb-8" />}

      {/* Sentiment bars */}
      <div className="mx-auto mb-10 max-w-[800px]">
        {comparing && hasComparison ? (
          <>
            {/* Paired distribution bars for comparison */}
            <div className="mb-2 flex justify-between text-[0.72rem] text-text-muted">
              <span>This month</span>
              <span>{observationCount} observations</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-xl bg-white/[0.04]">
              {barSegments.map((seg, i) => (
                <div
                  key={i}
                  className="h-full transition-all duration-1000"
                  style={{ width: `${seg.pct}%`, background: seg.color, opacity: seg.opacity }}
                />
              ))}
            </div>

            <div className="mb-2 mt-4 flex justify-between text-[0.72rem] text-text-muted">
              <span>Previous month</span>
              <span>{data.comparison!.totalObservations} observations</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-xl bg-white/[0.04]">
              {comparisonBar.map((seg, i) => (
                <div
                  key={i}
                  className="h-full transition-all duration-1000"
                  style={{ width: `${seg.pct}%`, background: seg.color, opacity: seg.opacity }}
                />
              ))}
            </div>

            <div className="mt-1.5 flex justify-between text-[0.72rem]">
              <span className="text-warm-1">Energised &middot; Urgent</span>
              <span className="text-cool-3">Uncertain &middot; Reflective</span>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex justify-between text-[0.72rem] text-text-muted">
              <span>Overall sentiment this month</span>
              <span>{observationCount} observations</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-xl bg-white/[0.04]">
              {barSegments.map((seg, i) => (
                <div
                  key={i}
                  className="h-full transition-all duration-1000"
                  style={{ width: `${seg.pct}%`, background: seg.color, opacity: seg.opacity }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[0.72rem]">
              <span className="text-warm-1">Energised &middot; Urgent</span>
              <span className="text-cool-3">Uncertain &middot; Reflective</span>
            </div>
          </>
        )}
      </div>

      {/* Themed insights */}
      {insightCards.length > 0 && (
        <div className="mx-auto grid max-w-[800px] gap-4 sm:grid-cols-3">
          {insightCards.map((theme) => (
            <div
              key={theme.title}
              className="rounded-[14px] border border-white/[0.04] bg-card p-5"
            >
              <div
                className="mb-3 h-[3px] w-8 rounded-sm"
                style={{ background: theme.gradient }}
              />
              <h4 className="font-display text-[1.05rem] font-normal">
                {theme.title}
              </h4>
              <p className="mt-2 text-[0.8rem] leading-relaxed text-text-secondary">
                {theme.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
