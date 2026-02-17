import type {
  ObservationView,
  SignalView,
  ConstellationNodeView,
  SentimentViewData,
  SentimentCell,
  SentimentInsight,
  ObservationSnippet,
} from "@/lib/types";
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

// --- Sentiment transforms ---

const SENTIMENT_TIERS = [
  "Quiet",
  "Reflective",
  "Calm",
  "Warm",
  "Energised",
  "Urgent",
] as const;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SentimentRow = {
  id: string;
  contentText: string;
  authorName: string | null;
  createdAt: Date;
  aiSentimentData: { energy: number; valence: number; arousal: number; label: string } | null;
  aiThemes: string[] | null;
};

function sentimentIndex(energy: number, valence: number): number {
  if (energy > 0.5 && valence < 0) return 5;  // Urgent
  if (energy > 0.3) return 4;                  // Energised
  if (valence > 0.2) return 3;                 // Warm
  if (energy > -0.3 && valence > -0.2) return 2; // Calm
  if (energy < -0.2) return 1;                 // Reflective
  return 0;                                     // Quiet
}

/** Build a 28-day grid of sentiment cells from rows within a given day range */
function buildPeriodGrid(
  rows: SentimentRow[],
  startDaysAgo: number,
  endDaysAgo: number,
  now: Date
): {
  cells: SentimentCell[];
  distribution: { label: string; pct: number }[];
  totalObservations: number;
  bucketThemes: Record<"hot" | "building" | "cool", Map<string, number>>;
} {
  const cells: SentimentCell[] = [];
  const bucketCounts = [0, 0, 0, 0, 0, 0];
  const bucketThemes: Record<"hot" | "building" | "cool", Map<string, number>> = {
    hot: new Map(),
    building: new Map(),
    cool: new Map(),
  };

  // Filter rows to this period
  const periodRows = rows.filter((r) => {
    const diffMs = now.getTime() - r.createdAt.getTime();
    const diffDays = diffMs / 86400000;
    return diffDays >= endDaysAgo && diffDays < startDaysAgo + 1;
  });

  for (let daysAgo = startDaysAgo; daysAgo >= endDaysAgo; daysAgo--) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = DAY_NAMES[d.getDay()];

    const dayRows = periodRows.filter((r) => {
      const rd = r.createdAt.toISOString().slice(0, 10);
      return rd === dateStr;
    });

    let colorIndex = 0;
    let label: string = SENTIMENT_TIERS[0];
    const count = dayRows.length;
    const snippets: ObservationSnippet[] = [];

    if (count > 0) {
      const withData = dayRows.filter((r) => r.aiSentimentData);
      if (withData.length > 0) {
        const avgEnergy =
          withData.reduce((s, r) => s + r.aiSentimentData!.energy, 0) / withData.length;
        const avgValence =
          withData.reduce((s, r) => s + r.aiSentimentData!.valence, 0) / withData.length;
        colorIndex = sentimentIndex(avgEnergy, avgValence);
        label = SENTIMENT_TIERS[colorIndex];
      }

      for (const row of dayRows) {
        const sentLabel = row.aiSentimentData?.label ?? "Unknown";
        snippets.push({
          id: row.id,
          text: row.contentText.length > 120
            ? row.contentText.slice(0, 120) + "\u2026"
            : row.contentText,
          author: row.authorName ?? "Anonymous",
          sentimentLabel: sentLabel,
        });
      }

      for (const row of dayRows) {
        if (!row.aiSentimentData) continue;
        const idx = sentimentIndex(row.aiSentimentData.energy, row.aiSentimentData.valence);
        bucketCounts[idx]++;

        const bucket: "hot" | "building" | "cool" =
          idx >= 4 ? "hot" : idx >= 2 ? "building" : "cool";
        for (const theme of row.aiThemes ?? []) {
          bucketThemes[bucket].set(theme, (bucketThemes[bucket].get(theme) ?? 0) + 1);
        }
      }
    }

    cells.push({ date: dateStr, dayLabel, colorIndex, label, count, observations: snippets });
  }

  const totalWithSentiment = bucketCounts.reduce((a, b) => a + b, 0);
  const distribution = SENTIMENT_TIERS.map((label, i) => ({
    label,
    pct: totalWithSentiment > 0 ? Math.round((bucketCounts[i] / totalWithSentiment) * 100) : 0,
  }));

  return { cells, distribution, totalObservations: periodRows.length, bucketThemes };
}

export function toSentimentViewData(rows: SentimentRow[]): SentimentViewData {
  if (rows.length === 0) {
    return { cells: [], distribution: [], insights: [], totalObservations: 0, hasData: false };
  }

  const now = new Date();

  // Current period: days 0–27
  const current = buildPeriodGrid(rows, 27, 0, now);

  // Previous period: days 28–55
  const previous = buildPeriodGrid(rows, 55, 28, now);

  // Insights — top themes per bucket (current period only)
  const insights: SentimentInsight[] = [];
  const bucketMeta: { key: "hot" | "building" | "cool"; title: string }[] = [
    { key: "hot", title: "What\u2019s running hot" },
    { key: "building", title: "Where energy is building" },
    { key: "cool", title: "Cool and uncertain" },
  ];

  for (const { key, title } of bucketMeta) {
    const themeMap = current.bucketThemes[key];
    if (themeMap.size === 0) continue;
    const sorted = [...themeMap.entries()].sort((a, b) => b[1] - a[1]);
    const topThemes = sorted.slice(0, 3).map(([t]) => t);
    insights.push({
      title,
      text: topThemes.join(", "),
      bucket: key,
    });
  }

  const result: SentimentViewData = {
    cells: current.cells,
    distribution: current.distribution,
    insights,
    totalObservations: current.totalObservations,
    hasData: true,
  };

  // Attach comparison if previous period has any data
  if (previous.totalObservations > 0) {
    result.comparison = {
      cells: previous.cells,
      distribution: previous.distribution,
      totalObservations: previous.totalObservations,
    };
  }

  return result;
}
