"use client";

import type { CollectionView, ObservationView } from "@/lib/types";

/**
 * Source filter value:
 *  - "all"              → every observation
 *  - "exclude"          → direct only: not from a collection or a reflection
 *  - "collections"      → only observations from any collection
 *  - "reflections"      → only observations that came from a reflection response
 *  - <collection id>    → only observations from that specific collection
 */
export type SourceFilterValue = "all" | "exclude" | "collections" | "reflections" | string;

/** Returns true if the observation passes the given source filter. */
export function matchesSource(obs: ObservationView, value: SourceFilterValue): boolean {
  if (value === "all") return true;
  if (value === "exclude") return !obs.collectionId && !obs.reflectionId;
  if (value === "collections") return !!obs.collectionId;
  if (value === "reflections") return !!obs.reflectionId;
  return obs.collectionId === value;
}

export function SourceFilter({
  collections,
  value,
  onChange,
  hasReflections = false,
}: {
  collections: CollectionView[];
  value: SourceFilterValue;
  onChange: (value: SourceFilterValue) => void;
  hasReflections?: boolean;
}) {
  // Nothing to filter by → hide the control entirely.
  if (collections.length === 0 && !hasReflections) return null;

  // Native <option> popups render with an OS-default (white) background, so we
  // set a solid dark surface + light text explicitly on every option to match
  // the app chrome. `--color-surface` is the same fill used by the app's menus.
  const optionStyle = { background: "#141b2d", color: "#e8e4df" };

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[0.7rem] text-text-secondary">Source:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by source"
        className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[0.75rem] text-text-secondary outline-none transition-colors focus:border-cool-1/30"
        style={{ background: "var(--color-surface)" }}
      >
        <option value="all" style={optionStyle}>All sources</option>
        <option value="exclude" style={optionStyle}>Direct only</option>
        {collections.length > 0 && (
          <option value="collections" style={optionStyle}>Collections only</option>
        )}
        {hasReflections && (
          <option value="reflections" style={optionStyle}>Reflections only</option>
        )}
        {collections.map((c) => (
          <option key={c.id} value={c.id} style={optionStyle}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
