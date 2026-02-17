import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { getEnrichmentModel } from "../providers/registry";
import { zodToAISchema } from "../schema";

const enrichmentSchema = z.object({
  sentiment: z.object({
    energy: z.number().min(-1).max(1),
    valence: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    label: z.string(),
  }),
  themes: z.array(z.string()).min(1).max(5),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["person", "place", "organisation", "concept", "project"]),
    })
  ),
});

/** Extract sentiment, themes, and entities from an observation via Claude Haiku */
export async function enrichObservation(observationId: string): Promise<void> {
  const [obs] = await db
    .select({ id: observations.id, contentText: observations.contentText })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs) {
    console.error(`[enrich] Observation ${observationId} not found`);
    return;
  }

  const { object } = await generateObject({
    model: getEnrichmentModel(),
    schema: zodToAISchema(enrichmentSchema),
    prompt: `Analyse the following observation from a workplace/organisational sensing context. Extract sentiment (energy, valence, arousal as -1 to 1 floats, plus a short label), key themes (1-5 words each), and named entities.

Observation: "${obs.contentText}"`,
  });

  const result = object as z.infer<typeof enrichmentSchema>;

  await db
    .update(observations)
    .set({
      aiSentiment: result.sentiment.label,
      aiSentimentData: result.sentiment,
      aiThemes: result.themes,
      aiEntities: result.entities,
      aiProcessedAt: new Date(),
    })
    .where(eq(observations.id, observationId));
}
