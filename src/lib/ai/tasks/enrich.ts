import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { getEnrichmentModel } from "../providers/registry";
import { zodToAISchema } from "../schema";

const enrichmentSchema = z.object({
  sentiment: z.object({
    // min/max omitted — Anthropic rejects minimum/maximum constraints on number types
    energy: z.number(),
    valence: z.number(),
    arousal: z.number(),
    label: z.string(),
  }),
  // min/max array constraints omitted — Anthropic rejects minItems/maxItems
  themes: z.array(z.string()),
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

  // Include image descriptions and voice transcripts if available
  const media = await getMediaForObservation(observationId);
  const imageDescriptions = media
    .filter((m) => m.aiDescription)
    .map((m) => m.aiDescription!);
  const voiceTranscripts = media
    .filter((m) => m.aiTranscript)
    .map((m) => m.aiTranscript!);

  let prompt = `Analyse the following observation from a workplace/organisational sensing context. Extract sentiment (energy, valence, arousal as -1 to 1 floats, plus a short label), key themes (1-5 words each), and named entities.

Observation: "${obs.contentText}"`;

  if (imageDescriptions.length > 0) {
    prompt += `\n\nAttached images:\n${imageDescriptions.map((d, i) => `Image ${i + 1}: ${d}`).join("\n")}`;
  }

  if (voiceTranscripts.length > 0) {
    prompt += `\n\nVoice transcripts:\n${voiceTranscripts.map((t, i) => `Voice ${i + 1}: ${t}`).join("\n")}`;
  }

  const imageOcrTexts = media
    .filter((m) => m.type === "image" && m.aiExtractedText)
    .map((m) => m.aiExtractedText!);
  if (imageOcrTexts.length > 0) {
    prompt += `\n\nText extracted from images:\n${imageOcrTexts.map((t, i) => `Image ${i + 1}: ${t}`).join("\n")}`;
  }

  const fileTexts = media
    .filter((m) => m.type === "file" && m.aiExtractedText)
    .map((m) => m.aiExtractedText!);
  if (fileTexts.length > 0) {
    prompt += `\n\nAttached file content:\n${fileTexts.map((t, i) => `File ${i + 1}: ${t}`).join("\n")}`;
  }

  const { object } = await generateObject({
    model: getEnrichmentModel(),
    schema: zodToAISchema(enrichmentSchema),
    prompt,
  });

  const result = object as z.infer<typeof enrichmentSchema>;

  await db
    .update(observations)
    .set({
      aiSentiment: result.sentiment.label,
      aiSentimentData: result.sentiment,
      aiThemes: result.themes,
      aiEntities: result.entities,
      // aiProcessedAt is set once, at the end of the pipeline — not here — so it
      // unambiguously means "pipeline complete", not "enrichment ran".
    })
    .where(eq(observations.id, observationId));
}
