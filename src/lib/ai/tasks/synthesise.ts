import { generateObject } from "ai";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  observations,
  signals,
  signalObservations,
  signalSnapshots,
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

  // Update observation signal strengths
  const strengthMap: Record<string, "strong" | "emerging" | "weak"> = {
    strong: "strong",
    emerging: "emerging",
    weak: "weak",
  };

  const obsIds = await db
    .select({ observationId: signalObservations.observationId })
    .from(signalObservations)
    .where(eq(signalObservations.signalId, signalId));

  if (obsIds.length > 0) {
    await db
      .update(observations)
      .set({ signalStrength: strengthMap[result.strength] })
      .where(
        inArray(
          observations.id,
          obsIds.map((o) => o.observationId)
        )
      );
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
