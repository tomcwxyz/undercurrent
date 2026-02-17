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
