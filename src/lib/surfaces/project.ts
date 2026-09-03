import type { SentimentViewData, SignalView } from "@/lib/types";
import { swellsSurfaceProfile } from "./profiles";
import type {
  SwellsSemanticScene,
  SwellsSurfaceId,
  SwellsSurfaceProjection,
  SwellsTemperatureBand,
  SwellsTemperatureReading,
  SwellsTemperatureTrend,
} from "./types";

const TEMPERATURE_BANDS: SwellsTemperatureBand[] = [
  "quiet",
  "reflective",
  "calm",
  "warm",
  "energised",
  "urgent",
];

function weightedTemperature(
  distribution: SentimentViewData["distribution"]
): number | null {
  let total = 0;
  let weighted = 0;

  distribution.forEach((item, index) => {
    const pct = Number(item.pct);
    if (!Number.isFinite(pct) || pct <= 0) return;
    total += pct;
    weighted += pct * index;
  });

  return total > 0 ? weighted / total : null;
}

function temperatureTrend(
  current: SentimentViewData["distribution"],
  comparison?: SentimentViewData["distribution"]
): SwellsTemperatureTrend {
  if (!comparison) return "unknown";

  const now = weightedTemperature(current);
  const before = weightedTemperature(comparison);
  if (now === null || before === null) return "unknown";

  const delta = now - before;
  if (delta >= 0.35) return "warming";
  if (delta <= -0.35) return "cooling";
  return "steady";
}

function buildTemperature(
  sentiment: SentimentViewData
): SwellsTemperatureReading {
  const weighted = weightedTemperature(sentiment.distribution);
  const index =
    weighted === null
      ? 0
      : Math.max(0, Math.min(5, Math.round(weighted)));

  const distributionLabel =
    sentiment.distribution[index]?.label ??
    TEMPERATURE_BANDS[index][0].toUpperCase() +
      TEMPERATURE_BANDS[index].slice(1);

  return {
    band: TEMPERATURE_BANDS[index],
    label: distributionLabel,
    index,
    observationCount: sentiment.totalObservations,
    trend: temperatureTrend(
      sentiment.distribution,
      sentiment.comparison?.distribution
    ),
    distribution: sentiment.distribution,
    cells: sentiment.cells.slice(-28),
  };
}

function signalScore(signal: SignalView): number {
  const direction =
    signal.direction === "strengthening"
      ? 4
      : signal.direction === "new"
        ? 3
        : 1;

  const strength =
    signal.strength === "strong"
      ? 3
      : signal.strength === "emerging"
        ? 2
        : 1;

  // Observation count helps break ties without allowing sheer volume to
  // overwhelm meaningful direction/strength.
  const evidence = Math.min(2, signal.observationCount / 6);

  return direction + strength + evidence;
}

export function buildSwellsSemanticScene({
  spaceId,
  signals,
  sentiment,
}: {
  spaceId: string;
  signals: SignalView[];
  sentiment: SentimentViewData;
}): SwellsSemanticScene {
  const swells = [...signals]
    .sort((a, b) => signalScore(b) - signalScore(a))
    .map((signal) => ({
      id: signal.id,
      title: signal.title,
      description: signal.description,
      strength: signal.strength,
      direction: signal.direction,
      observationCount: signal.observationCount,
      contributorCount: signal.contributorCount,
    }));

  const changes = swells
    .filter(
      (signal) =>
        signal.direction === "new" || signal.direction === "strengthening"
    )
    .map((signal) => ({
      id: `change:${signal.id}`,
      signalId: signal.id,
      title: signal.title,
      reason: signal.direction as "new" | "strengthening",
      observationCount: signal.observationCount,
    }));

  return {
    spaceId,
    generatedAt: new Date().toISOString(),
    temperature: buildTemperature(sentiment),
    swells,
    changes,
  };
}

/**
 * Pure projection from semantic Swells state to a particular surface.
 *
 * Projection can rank, bound and simplify. It must not mutate canonical Swells
 * records or create device-owned meaning.
 */
export function projectSwellsSurface(
  scene: SwellsSemanticScene,
  surface: SwellsSurfaceId
): SwellsSurfaceProjection {
  const profile = swellsSurfaceProfile(surface);
  const swells = scene.swells.slice(0, profile.interaction.maxSwells);
  const changes = scene.changes.filter((change) =>
    swells.some((signal) => signal.id === change.signalId)
  );

  const availableLenses: SwellsSurfaceProjection["availableLenses"] = [
    ...(profile.interaction.supportsCapture ? (["notice"] as const) : []),
    "temperature",
    ...(swells.length ? (["horizon", "swell"] as const) : []),
    ...(changes.length ? (["change"] as const) : []),
    ...(profile.interaction.supportsAsk && swells.length
      ? (["ask"] as const)
      : []),
  ];

  return {
    projectionId: `${scene.spaceId}:${surface}:${scene.generatedAt}`,
    surface,
    spaceId: scene.spaceId,
    generatedAt: scene.generatedAt,
    defaultLens: "temperature",
    availableLenses,
    temperature: scene.temperature,
    swells,
    changes,
    showEvidence: profile.interaction.supportsEvidenceInspection,
  };
}
