"use client";

import type { SwellsTemperatureReading } from "@/lib/surfaces/types";

const CELL_COLOURS = [
  "rgba(108, 92, 231, 0.42)",
  "rgba(69, 183, 209, 0.52)",
  "rgba(78, 205, 196, 0.52)",
  "rgba(255, 209, 102, 0.54)",
  "rgba(255, 140, 66, 0.62)",
  "rgba(255, 107, 74, 0.72)",
] as const;

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function R1TemperatureGrid({
  reading,
}: {
  reading: SwellsTemperatureReading;
}) {
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

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-[5px]">
        {padded.map((cell, index) => (
          <div
            key={cell.date || index}
            className="aspect-square rounded-[7px] border border-white/[0.035]"
            style={{
              background: cell.empty
                ? "rgba(255,255,255,0.018)"
                : CELL_COLOURS[Math.max(0, Math.min(5, cell.colorIndex))],
              boxShadow:
                !cell.empty && cell.count > 0
                  ? `inset 0 0 0 1px rgba(255,255,255,0.025), 0 0 13px ${CELL_COLOURS[
                      Math.max(0, Math.min(5, cell.colorIndex))
                    ]}`
                  : "none",
              opacity: cell.empty ? 0.45 : cell.count > 0 ? 1 : 0.55,
            }}
            aria-label={
              cell.empty
                ? undefined
                : `${cell.dayLabel}: ${cell.label}, ${cell.count} observations`
            }
          />
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[0.56rem] uppercase tracking-[0.08em] text-text-muted/70">
        {DAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
