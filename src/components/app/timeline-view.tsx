"use client";

import { useState, useMemo } from "react";
import type { TimelineEvent } from "@/lib/types";

const LOOP_LABELS = {
  single: "Single loop",
  double: "Double loop",
  triple: "Triple loop",
} as const;

const LOOP_COLORS = {
  single: "bg-cool-3/12 text-cool-3",
  double: "bg-warm-3/12 text-warm-3",
  triple: "bg-warm-1/12 text-warm-1",
} as const;

const STRENGTH_COLORS: Record<string, string> = {
  strong: "rgb(255,107,74)",
  emerging: "rgb(255,209,102)",
  weak: "rgb(69,183,209)",
};

const DIRECTION_LABELS: Record<string, string> = {
  strengthening: "Strengthening",
  steady: "Steady",
  new: "New",
};

interface TimelineViewProps {
  timelineEvents: TimelineEvent[];
}

function formatDateGroup(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function groupByDate(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const dateKey = event.timestamp.slice(0, 10);
    const existing = groups.get(dateKey) ?? [];
    existing.push(event);
    groups.set(dateKey, existing);
  }
  return Array.from(groups.entries());
}

export function TimelineView({ timelineEvents }: TimelineViewProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return timelineEvents;
    const q = search.toLowerCase();
    return timelineEvents.filter((event) => {
      if (event.type === "observation") {
        return event.text.toLowerCase().includes(q) || event.author.toLowerCase().includes(q);
      }
      if (event.type === "signal") {
        return event.signalTitle.toLowerCase().includes(q);
      }
      if (event.type === "reflection") {
        return event.prompt.toLowerCase().includes(q);
      }
      return false;
    });
  }, [timelineEvents, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light text-text-primary opacity-90">
          Timeline
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          Everything that&apos;s happened in this space, in one stream.
        </p>
      </div>

      {/* Search */}
      <div className="mx-auto mb-8 max-w-[640px]">
        <div className="relative">
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
            placeholder="Search timeline..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-4 text-[0.85rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
          />
        </div>
        {search && (
          <div className="mt-2 text-center text-[0.78rem] text-text-muted">
            Showing {filtered.length} of {timelineEvents.length}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative mx-auto max-w-[640px]">
        {/* Vertical spine */}
        <div
          className="absolute left-[11px] top-0 bottom-0 w-0.5 md:left-[15px]"
          style={{
            background: "linear-gradient(180deg, transparent, rgba(78,205,196,0.2) 5%, rgba(78,205,196,0.08) 80%, transparent)",
          }}
        />

        {groups.length === 0 ? (
          <div className="py-16 text-center text-[0.9rem] text-text-muted">
            {search ? "No matching events" : "No activity yet"}
          </div>
        ) : (
          groups.map(([dateKey, events]) => (
            <div key={dateKey} className="mb-6">
              {/* Date header */}
              <div className="sticky top-0 z-10 mb-3 flex items-center gap-3 py-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface md:h-8 md:w-8">
                  <div className="h-2 w-2 rounded-full bg-cool-1/60" />
                </div>
                <span className="text-[0.78rem] font-medium tracking-wide text-text-secondary">
                  {formatDateGroup(dateKey)}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-2.5 pl-8 md:pl-10">
                {events.map((event) => (
                  <TimelineCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  if (event.type === "observation") {
    return (
      <div className="rounded-2xl border border-white/[0.04] bg-card p-4 transition-colors hover:bg-card-hover">
        <div className="mb-1 flex items-center gap-2 text-[0.7rem] text-text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          Observation · {event.time}
        </div>
        <p className="text-[0.85rem] leading-relaxed text-text-primary">{event.text}</p>
        <div className="mt-1.5 text-[0.72rem] text-text-muted">{event.author}</div>
      </div>
    );
  }

  if (event.type === "signal") {
    const color = STRENGTH_COLORS[event.strength] ?? "rgb(78,205,196)";
    return (
      <div className="rounded-2xl border border-white/[0.04] bg-card p-4 transition-colors hover:bg-card-hover">
        <div className="mb-1 flex items-center gap-2 text-[0.7rem] text-text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
          Signal snapshot · {event.time}
        </div>
        <p className="text-[0.9rem] font-medium text-text-primary">{event.signalTitle}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-lg px-2 py-0.5 text-[0.7rem] font-medium"
            style={{
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
            }}
          >
            {event.strength}
          </span>
          <span className="text-[0.72rem] text-text-muted">
            {DIRECTION_LABELS[event.direction] ?? event.direction}
          </span>
        </div>
      </div>
    );
  }

  // reflection
  const loopLabel = LOOP_LABELS[event.learningLoop];
  const loopCls = LOOP_COLORS[event.learningLoop];
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-card p-4 transition-colors hover:bg-card-hover">
      <div className="mb-1 flex items-center gap-2 text-[0.7rem] text-text-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
        Reflection · {event.time}
      </div>
      <p className="text-[0.85rem] italic leading-relaxed text-text-primary">
        &ldquo;{event.prompt}&rdquo;
      </p>
      <div className="mt-2">
        <span className={`rounded-lg px-2 py-0.5 text-[0.7rem] font-medium ${loopCls}`}>
          {loopLabel}
        </span>
      </div>
    </div>
  );
}
