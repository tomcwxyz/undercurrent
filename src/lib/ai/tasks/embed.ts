import { embed } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { getEmbeddingModel } from "../providers/registry";
import { AI_CONFIG } from "../config";

/** Generate and store an embedding vector for an observation */
export async function embedObservation(observationId: string): Promise<void> {
  const [obs] = await db
    .select({ id: observations.id, contentText: observations.contentText })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs) {
    console.error(`[embed] Observation ${observationId} not found`);
    return;
  }

  // Combine text with image descriptions and voice transcripts for richer embeddings
  const parts = [obs.contentText];
  const media = await getMediaForObservation(observationId);
  for (const m of media) {
    if (m.aiDescription) parts.push(m.aiDescription);
    if (m.aiTranscript) parts.push(m.aiTranscript);
  }

  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: parts.join("\n\n"),
    providerOptions: {
      openai: { dimensions: AI_CONFIG.embedding.dimensions },
    },
  });

  await db
    .update(observations)
    .set({ aiEmbedding: embedding })
    .where(eq(observations.id, observationId));
}
