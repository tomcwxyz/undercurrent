import { generateObject } from "ai";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  observations,
  signals,
  signalObservations,
  signalSnapshots,
  constellationNodes,
} from "@/lib/db/schema";
import { notifySpaceMembers } from "@/lib/db/queries";
import { getSignalSynthesisModel } from "../providers/registry";
import { zodToAISchema } from "../schema";
import { findUnattachedClusters } from "./cluster";

const signalSynthesisSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(500),
  strength: z.enum(["strong", "emerging", "weak"]),
  direction: z.enum(["strengthening", "steady", "new"]),
});

/**
 * Re-synthesise a signal from its constituent observations.
 * Updates title, description, strength, direction and takes a snapshot.
 */
export async function evolveSignal(signalId: string, spaceId?: string): Promise<void> {
  // Read current strength before evolving (for transition detection)
  const [currentSignal] = await db
    .select({ strength: signals.strength, title: signals.title, spaceId: signals.spaceId })
    .from(signals)
    .where(eq(signals.id, signalId))
    .limit(1);

  const previousStrength = currentSignal?.strength;
  const resolvedSpaceId = spaceId ?? currentSignal?.spaceId;

  // Get all observations in this signal
  const obsRows = await db
    .select({
      contentText: observations.contentText,
      aiThemes: observations.aiThemes,
      aiSentimentData: observations.aiSentimentData,
      authorId: observations.authorId,
    })
    .from(signalObservations)
    .innerJoin(observations, eq(observations.id, signalObservations.observationId))
    .where(eq(signalObservations.signalId, signalId));

  if (obsRows.length === 0) return;

  const observationTexts = obsRows
    .map((o, i) => `${i + 1}. ${o.contentText}`)
    .join("\n");

  const allThemes = obsRows.flatMap((o) => o.aiThemes ?? []);
  const uniqueThemes = [...new Set(allThemes)];

  const { object } = await generateObject({
    model: getSignalSynthesisModel(),
    schema: zodToAISchema(signalSynthesisSchema),
    prompt: `You are analysing observations from an organisational sensing platform. These observations have been clustered as related. Synthesise them into a coherent signal.

Observations:
${observationTexts}

Common themes: ${uniqueThemes.join(", ")}

Generate a signal with:
- title: A concise name for this emerging pattern (max 100 chars)
- description: What this signal means and why it matters (max 500 chars)
- strength: "strong" (clear pattern, many observations), "emerging" (becoming visible), or "weak" (early hints)
- direction: "strengthening" (growing), "steady" (stable), or "new" (just appeared)`,
  });

  const result = object as z.infer<typeof signalSynthesisSchema>;

  const uniqueContributors = new Set(obsRows.map((o) => o.authorId).filter(Boolean));

  // Compute aggregate sentiment
  const sentimentValues = obsRows
    .map((o) => o.aiSentimentData)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const sentimentAgg =
    sentimentValues.length > 0
      ? {
          avgEnergy:
            sentimentValues.reduce((sum, s) => sum + s.energy, 0) /
            sentimentValues.length,
          avgValence:
            sentimentValues.reduce((sum, s) => sum + s.valence, 0) /
            sentimentValues.length,
          dominantThemes: uniqueThemes.slice(0, 5),
        }
      : undefined;

  // Update signal
  await db
    .update(signals)
    .set({
      title: result.title,
      description: result.description,
      strength: result.strength,
      direction: result.direction,
      observationCount: obsRows.length,
      contributorCount: uniqueContributors.size,
      lastUpdated: new Date(),
      aiGenerated: true,
      sentiment: sentimentAgg,
    })
    .where(eq(signals.id, signalId));

  // Take snapshot
  await db.insert(signalSnapshots).values({
    signalId,
    strength: result.strength,
    direction: result.direction,
    observationCount: obsRows.length,
    contributorCount: uniqueContributors.size,
    sentimentAgg: sentimentAgg
      ? { avgEnergy: sentimentAgg.avgEnergy, avgValence: sentimentAgg.avgValence }
      : undefined,
  });

  // Notify if strength changed
  if (previousStrength && result.strength !== previousStrength && resolvedSpaceId) {
    const signalTitle = currentSignal?.title ?? "A signal";
    await notifySpaceMembers(
      resolvedSpaceId,
      "signal_transition",
      `Signal strength changed: ${signalTitle}`,
      `Moved from ${previousStrength} to ${result.strength}`,
      "landscape"
    );
  }

  // Upsert constellation node for this signal
  await upsertConstellationNode(signalId, resolvedSpaceId!, result.title, result.description, result.strength);

  // Update observation signal strengths
  const obsIds = await db
    .select({ observationId: signalObservations.observationId })
    .from(signalObservations)
    .where(eq(signalObservations.signalId, signalId));

  if (obsIds.length > 0) {
    await db
      .update(observations)
      .set({ signalStrength: result.strength })
      .where(
        inArray(
          observations.id,
          obsIds.map((o) => o.observationId)
        )
      );
  }
}

/** Derive a stable 0–1 position from a UUID segment */
function hashToPosition(hex: string): number {
  return parseInt(hex.slice(0, 4), 16) / 0xffff;
}

const STRENGTH_SIZE: Record<string, number> = {
  strong: 1.2,
  emerging: 0.9,
  weak: 0.6,
};

/** Create or update the constellation node for a signal */
async function upsertConstellationNode(
  signalId: string,
  spaceId: string,
  label: string,
  description: string,
  strength: string
): Promise<void> {
  if (!spaceId) return;

  const [existing] = await db
    .select({ id: constellationNodes.id })
    .from(constellationNodes)
    .where(eq(constellationNodes.signalId, signalId))
    .limit(1);

  const size = STRENGTH_SIZE[strength] ?? 0.8;
  const type = strength as "strong" | "emerging" | "weak";

  if (existing) {
    await db
      .update(constellationNodes)
      .set({ label, description, size, type })
      .where(eq(constellationNodes.id, existing.id));
  } else {
    // Derive stable position from signal ID so nodes don't jump on re-runs
    const x = 0.1 + hashToPosition(signalId.replace(/-/g, "").slice(0, 4)) * 0.8;
    const y = 0.1 + hashToPosition(signalId.replace(/-/g, "").slice(20, 24)) * 0.8;
    await db.insert(constellationNodes).values({
      spaceId,
      signalId,
      label,
      description,
      x,
      y,
      size,
      type,
      connections: [],
      isDemo: false,
    });
  }
}

/**
 * Find unattached observation clusters and create new signals for each.
 */
export async function synthesiseNewSignals(spaceId: string): Promise<void> {
  const clusters = await findUnattachedClusters(spaceId);

  for (const cluster of clusters) {
    try {
      // Create a new signal
      const [newSignal] = await db
        .insert(signals)
        .values({
          spaceId,
          title: "Processing...",
          description: "",
          strength: "weak",
          direction: "new",
          observationCount: cluster.observationIds.length,
          aiGenerated: true,
        })
        .returning({ id: signals.id });

      // Link observations to signal
      await db.insert(signalObservations).values(
        cluster.observationIds.map((obsId) => ({
          signalId: newSignal.id,
          observationId: obsId,
        }))
      );

      // Evolve the signal (generates title, description etc.)
      await evolveSignal(newSignal.id);
    } catch (error) {
      console.error(
        `[synthesise] Failed to create signal from cluster (${cluster.observationIds.length} obs):`,
        error
      );
    }
  }
}
