import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observationMedia } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { getMediaDescriptionModel } from "../providers/registry";
import { zodToAISchema } from "../schema";

const imageAnalysisSchema = z.object({
  description: z
    .string()
    .describe(
      "2-3 sentence visual description of the image focusing on what is visible and relevant"
    ),
  extractedText: z
    .string()
    .describe(
      "All readable text visible in the image (whiteboards, documents, signs, handwriting, etc). Empty string if no meaningful text is present."
    ),
});

/** Generate AI description and OCR text for image attachments on an observation */
export async function describeMediaForObservation(
  observationId: string
): Promise<void> {
  const media = await getMediaForObservation(observationId);
  const images = media.filter((m) => m.type === "image");

  if (images.length === 0) return;

  for (const image of images) {
    try {
      const { object } = await generateObject({
        model: getMediaDescriptionModel(),
        schema: zodToAISchema(imageAnalysisSchema),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse this image attached to a workplace observation. Provide a visual description and extract any readable text.",
              },
              {
                type: "image",
                image: new URL(image.url),
              },
            ],
          },
        ],
      });

      const result = object as z.infer<typeof imageAnalysisSchema>;

      await db
        .update(observationMedia)
        .set({
          aiDescription: result.description,
          aiExtractedText: result.extractedText || null,
        })
        .where(eq(observationMedia.id, image.id));
    } catch (error) {
      console.error(
        `[describe-media] Failed to analyse image ${image.id}:`,
        error
      );
    }
  }
}
