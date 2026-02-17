import { embedObservation } from "./tasks/embed";
import { enrichObservation } from "./tasks/enrich";
import { clusterObservation } from "./tasks/cluster";
import { evolveSignal, synthesiseNewSignals } from "./tasks/synthesise";
import { checkReflectionTriggers } from "./tasks/reflect";

/**
 * Full AI processing pipeline for a new observation.
 * Runs asynchronously after the HTTP response via `after()`.
 *
 * Steps:
 * 1. Embed — generate vector embedding
 * 2. Enrich — extract sentiment, themes, entities
 * 3. Cluster — find similar observations / existing signals
 * 4. If clustered → evolve the signal → check reflection triggers
 * 5. If not clustered → try to synthesise new signals from unattached obs
 */
export async function processObservation(
  observationId: string,
  spaceId: string
): Promise<void> {
  try {
    console.log(`[pipeline] Processing observation ${observationId}`);

    // Step 1: Embed
    await embedObservation(observationId);
    console.log(`[pipeline] Embedded ${observationId}`);

    // Step 2: Enrich
    await enrichObservation(observationId);
    console.log(`[pipeline] Enriched ${observationId}`);

    // Step 3: Cluster
    const signalId = await clusterObservation(observationId, spaceId);
    console.log(
      `[pipeline] Clustered ${observationId} → ${signalId ?? "unattached"}`
    );

    if (signalId) {
      // Step 4a: Evolve the signal this observation was added to
      await evolveSignal(signalId, spaceId);
      console.log(`[pipeline] Evolved signal ${signalId}`);

      // Step 4b: Check if this signal should trigger a reflection
      await checkReflectionTriggers(signalId, spaceId);
      console.log(`[pipeline] Checked reflection triggers for ${signalId}`);
    } else {
      // Step 5: Try to form new signals from unattached observations
      await synthesiseNewSignals(spaceId);
      console.log(`[pipeline] Synthesised new signals for space ${spaceId}`);
    }

    console.log(`[pipeline] Done processing ${observationId}`);
  } catch (error) {
    console.error(`[pipeline] Error processing observation ${observationId}:`, error);
  }
}
