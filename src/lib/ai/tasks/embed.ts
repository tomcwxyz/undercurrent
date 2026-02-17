import { embed } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
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

  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: obs.contentText,
    providerOptions: {
      openai: { dimensions: AI_CONFIG.embedding.dimensions },
    },
  });

  await db
    .update(observations)
    .set({ aiEmbedding: embedding })
    .where(eq(observations.id, observationId));
}
