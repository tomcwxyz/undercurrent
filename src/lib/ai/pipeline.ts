import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { describeMediaForObservation } from "./tasks/describe-media";
import { transcribeVoiceForObservation } from "./tasks/transcribe-voice";
import { extractFileTextForObservation } from "./tasks/extract-file-text";
import { embedObservation } from "./tasks/embed";
import { enrichObservation } from "./tasks/enrich";
import { clusterObservation } from "./tasks/cluster";
import { evolveSignal, synthesiseNewSignals } from "./tasks/synthesise";
import { checkReflectionTriggers } from "./tasks/reflect";

/** Placeholder used when user submits an image-only observation */
export const IMAGE_OBSERVATION_PLACEHOLDER = "[Extracting from image\u2026]";

/**
 * Full AI processing pipeline for a new observation.
 * Runs asynchronously after the HTTP response via `after()`.
 *
 * Steps:
 * 1. Describe media — generate AI descriptions for image attachments (non-critical)
 * 2. Embed — generate vector embedding, includes image descriptions (critical)
 * 3. Enrich — extract sentiment, themes, entities (non-critical)
 * 4. Cluster — find similar observations / existing signals
 * 5. If clustered → evolve the signal → check reflection triggers
 * 6. If not clustered → try to synthesise new signals from unattached obs
 *
 * Each step is independently error-handled so a non-critical failure
 * doesn't block later steps.
 */
export async function processObservation(
  observationId: string,
  spaceId: string
): Promise<void> {
  console.log(`[pipeline] Processing observation ${observationId}`);

  // Step 1: Describe media + transcribe voice — non-critical, enriches embed + enrich
  const mediaResults = await Promise.allSettled([
    describeMediaForObservation(observationId),
    transcribeVoiceForObservation(observationId),
    extractFileTextForObservation(observationId),
  ]);
  const mediaLabels = ["Describe media", "Transcribe voice", "Extract file text"];
  for (const [i, result] of mediaResults.entries()) {
    const label = mediaLabels[i];
    if (result.status === "fulfilled") {
      console.log(`[pipeline] ${label} done for ${observationId}`);
    } else {
      console.error(`[pipeline] ${label} failed for ${observationId} (continuing):`, result.reason);
    }
  }

  // Step 1b: Backfill contentText for image-only observations
  try {
    await backfillContentText(observationId);
  } catch (error) {
    console.error(`[pipeline] Backfill failed for ${observationId} (continuing):`, error);
  }

  // Step 2: Embed — critical path, can't cluster without a vector
  try {
    await embedObservation(observationId);
    console.log(`[pipeline] Embedded ${observationId}`);
  } catch (error) {
    console.error(`[pipeline] Embed failed for ${observationId}:`, error);
    await markProcessed(observationId);
    return;
  }

  // Step 3: Enrich — non-critical, clustering uses embeddings not enrichment
  try {
    await enrichObservation(observationId);
    console.log(`[pipeline] Enriched ${observationId}`);
  } catch (error) {
    console.error(`[pipeline] Enrich failed for ${observationId} (continuing):`, error);
  }

  // Step 4: Cluster
  let signalId: string | null = null;
  try {
    signalId = await clusterObservation(observationId, spaceId);
    console.log(
      `[pipeline] Clustered ${observationId} → ${signalId ?? "unattached"}`
    );
  } catch (error) {
    console.error(`[pipeline] Cluster failed for ${observationId} (continuing):`, error);
  }

  if (signalId) {
    // Step 5a: Evolve the signal this observation was added to
    try {
      await evolveSignal(signalId, spaceId);
      console.log(`[pipeline] Evolved signal ${signalId}`);
    } catch (error) {
      console.error(`[pipeline] Evolve failed for signal ${signalId}:`, error);
    }

    // Step 5b: Check if this signal should trigger a reflection
    try {
      await checkReflectionTriggers(signalId, spaceId);
      console.log(`[pipeline] Checked reflection triggers for ${signalId}`);
    } catch (error) {
      console.error(`[pipeline] Reflect failed for signal ${signalId}:`, error);
    }
  } else {
    // Step 6: Try to form new signals from unattached observations
    try {
      await synthesiseNewSignals(spaceId);
      console.log(`[pipeline] Synthesised new signals for space ${spaceId}`);
    } catch (error) {
      console.error(`[pipeline] Synthesise failed for space ${spaceId}:`, error);
    }
  }

  await markProcessed(observationId);
  console.log(`[pipeline] Done processing ${observationId}`);
}

/**
 * For image-only observations (no user text), replace the placeholder
 * with OCR-extracted text or fall back to the AI image description.
 */
async function backfillContentText(observationId: string): Promise<void> {
  const [obs] = await db
    .select({ id: observations.id, contentText: observations.contentText })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs || obs.contentText !== IMAGE_OBSERVATION_PLACEHOLDER) return;

  const media = await getMediaForObservation(observationId);
  const imageMedia = media.filter((m) => m.type === "image");

  // Prefer OCR text, fall back to AI description
  const ocrText = imageMedia
    .map((m) => m.aiExtractedText)
    .filter(Boolean)
    .join("\n\n");

  const descriptionText = imageMedia
    .map((m) => m.aiDescription)
    .filter(Boolean)
    .join("\n\n");

  const backfill = ocrText || descriptionText;
  if (!backfill) return;

  await db
    .update(observations)
    .set({ contentText: backfill })
    .where(eq(observations.id, observationId));

  console.log(`[pipeline] Backfilled contentText for ${observationId}`);
}

/** Mark observation as processed regardless of pipeline outcome */
async function markProcessed(observationId: string): Promise<void> {
  try {
    await db
      .update(observations)
      .set({ aiProcessedAt: new Date() })
      .where(eq(observations.id, observationId));
  } catch (error) {
    console.error(`[pipeline] Failed to mark ${observationId} as processed:`, error);
  }
}
