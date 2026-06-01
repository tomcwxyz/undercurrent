"use client";

import type { CollectionView, ObservationView } from "@/lib/types";

/**
 * Source filter value:
 *  - "all"              → every observation
 *  - "exclude"          → only observations not from a collection
 *  - "collections"      → only observations from any collection
 *  - <collection id>    → only observations from that specific collection
 */
export type SourceFilterValue = "all" | "exclude" | "collections" | string;

/** Returns true if the observation passes the given source filter. */
export function matchesSource(obs: ObservationView, value: SourceFilterValue): boolean {
  if (value === "all") return true;
  if (value === "exclude") return !obs.collectionId;
  if (value === "collections") return !!obs.collectionId;
  return obs.collectionId === value;
}

export function SourceFilter({
  collections,
  value,
  onChange,
}: {
  collections: CollectionView[];
  value: SourceFilterValue;
  onChange: (value: SourceFilterValue) => void;
}) {
  // No collections in this space → nothing to filter by, hide the control.
  if (collections.length === 0) return null;

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[0.7rem] text-text-secondary">Source:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by source"
        className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[0.75rem] text-text-secondary outline-none transition-colors focus:border-cool-1/30"
      >
        <option value="all">All sources</option>
        <option value="exclude">Direct only (exclude collections)</option>
        <option value="collections">Collections only</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
