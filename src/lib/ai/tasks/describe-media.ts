import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observationMedia } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { getMediaDescriptionModel } from "../providers/registry";

/** Generate AI descriptions for image attachments on an observation */
export async function describeMediaForObservation(
  observationId: string
): Promise<void> {
  const media = await getMediaForObservation(observationId);
  const images = media.filter((m) => m.type === "image");

  if (images.length === 0) return;

  for (const image of images) {
    try {
      const { text } = await generateText({
        model: getMediaDescriptionModel(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image attached to a workplace observation. Focus on what's visible and relevant — people, objects, text, charts, whiteboards, environments. Be concise (2-3 sentences).",
              },
              {
                type: "image",
                image: new URL(image.url),
              },
            ],
          },
        ],
      });

      await db
        .update(observationMedia)
        .set({ aiDescription: text })
        .where(eq(observationMedia.id, image.id));
    } catch (error) {
      console.error(
        `[describe-media] Failed to describe image ${image.id}:`,
        error
      );
      // Continue with remaining images — don't let one failure block others
    }
  }
}
