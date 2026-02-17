import type { ObservationView, SignalView, ConstellationNodeView } from "@/lib/types";
import type { observations, signals, constellationNodes } from "./schema";

type ObservationRow = typeof observations.$inferSelect;
type SignalRow = typeof signals.$inferSelect;
type ConstellationNodeRow = typeof constellationNodes.$inferSelect;

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

export function toObservationView(row: ObservationRow): ObservationView {
  return {
    id: row.id,
    author: row.authorName ?? "Anonymous",
    time: formatRelativeTime(row.createdAt),
    text: row.contentText,
    signalStrength: row.signalStrength ?? "single",
    hasImage: row.hasImage ?? false,
    imageLabel: row.imageLabel ?? undefined,
  };
}

export function toSignalView(row: SignalRow): SignalView {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    strength: row.strength,
    direction: row.direction,
    observationCount: row.observationCount ?? 0,
    contributorCount: row.contributorCount ?? 0,
  };
}

export function toConstellationNodeView(
  row: ConstellationNodeRow
): ConstellationNodeView {
  return {
    id: row.id,
    label: row.label,
    x: row.x,
    y: row.y,
    size: row.size,
    type: row.type,
    connections: (row.connections as string[]) ?? [],
    text: row.description ?? "",
  };
}
