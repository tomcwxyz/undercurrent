import type { SentimentViewData, SignalView } from "@/lib/types";

export type SwellsSurfaceId = "web" | "r1" | "tablet" | "epaper";

export type SwellsLens =
  | "notice"
  | "temperature"
  | "horizon"
  | "swell"
  | "change"
  | "ask";

export type SwellsTemperatureTrend =
  | "warming"
  | "steady"
  | "cooling"
  | "unknown";

export type SwellsTemperatureBand =
  | "quiet"
  | "reflective"
  | "calm"
  | "warm"
  | "energised"
  | "urgent";

export interface SwellsTemperatureReading {
  band: SwellsTemperatureBand;
  label: string;
  index: number;
  observationCount: number;
  trend: SwellsTemperatureTrend;
  distribution: SentimentViewData["distribution"];
}

export interface SwellsSwellReading {
  id: string;
  title: string;
  description: string;
  strength: SignalView["strength"];
  direction: SignalView["direction"];
  observationCount: number;
  contributorCount: number;
}

export interface SwellsChangeReading {
  id: string;
  signalId: string;
  title: string;
  reason: "new" | "strengthening";
  observationCount: number;
}

export interface SwellsSemanticScene {
  spaceId: string;
  generatedAt: string;
  temperature: SwellsTemperatureReading;
  swells: SwellsSwellReading[];
  changes: SwellsChangeReading[];
}

export interface SwellsSurfaceProfile {
  id: SwellsSurfaceId;
  display: {
    width?: number;
    height?: number;
    colour: "full" | "limited" | "mono";
    animation: boolean;
    persistent: boolean;
  };
  input: {
    touch: boolean;
    voice: boolean;
    swipe: boolean;
    wheel: boolean;
    keyboard: boolean;
  };
  interaction: {
    maxPrimaryItems: number;
    maxSwells: number;
    supportsCapture: boolean;
    supportsAsk: boolean;
    supportsEvidenceInspection: boolean;
  };
  presentation: {
    density: "glance" | "focused" | "rich";
  };
}

export interface SwellsSurfaceProjection {
  projectionId: string;
  surface: SwellsSurfaceId;
  spaceId: string;
  generatedAt: string;
  defaultLens: SwellsLens;
  availableLenses: SwellsLens[];
  temperature: SwellsTemperatureReading;
  swells: SwellsSwellReading[];
  changes: SwellsChangeReading[];
  showEvidence: boolean;
}
