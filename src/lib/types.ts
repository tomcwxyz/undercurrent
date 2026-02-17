export interface ObservationView {
  id: string;
  author: string;
  time: string;
  text: string;
  signalStrength: "strong" | "emerging" | "weak" | "single";
  hasImage: boolean;
  imageLabel?: string;
}

export interface SignalView {
  id: string;
  title: string;
  description: string;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
  observationCount: number;
  contributorCount: number;
}

export interface ConstellationNodeView {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  type: "strong" | "emerging" | "weak" | "single";
  connections: string[];
  text: string;
}

export interface SpaceStats {
  observationCount: number;
  signalCount: number;
}

export interface ObservationSnippet {
  id: string;
  text: string;           // truncated to ~120 chars
  author: string;
  sentimentLabel: string;
}

export interface SentimentCell {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "Mon"..."Sun"
  colorIndex: number; // 0-5 → WARM_COLORS/SENTIMENT_LABELS
  label: string;      // "Quiet" → "Urgent"
  count: number;
  observations: ObservationSnippet[];
}

export interface SentimentInsight {
  title: string;
  text: string;
  bucket: "hot" | "building" | "cool";
}

export interface SentimentViewData {
  cells: SentimentCell[];
  distribution: { label: string; pct: number }[];
  insights: SentimentInsight[];
  totalObservations: number;
  hasData: boolean;
  comparison?: {
    cells: SentimentCell[];
    distribution: { label: string; pct: number }[];
    totalObservations: number;
  };
}
