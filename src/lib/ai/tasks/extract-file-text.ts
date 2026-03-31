import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observationMedia } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";
import { getMediaDescriptionModel } from "../providers/registry";

const TEXT_MIME_TYPES = new Set(["text/plain", "text/csv"]);
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);
const MAX_EXTRACTED_LENGTH = 10_000;

/** Extract text content from file attachments on an observation */
export async function extractFileTextForObservation(
  observationId: string
): Promise<void> {
  const media = await getMediaForObservation(observationId);
  const items = media.filter(
    (m) => (m.type === "file" || m.type === "image") && !m.aiExtractedText
  );

  if (items.length === 0) return;

  for (const item of items) {
    try {
      let extractedText: string | null = null;

      if (TEXT_MIME_TYPES.has(item.mimeType)) {
        extractedText = await extractPlainText(item.url);
      } else if (item.mimeType === "application/pdf") {
        extractedText = await extractPdfText(item.url);
      } else if (IMAGE_MIME_TYPES.has(item.mimeType)) {
        extractedText = await extractImageText(item.url);
      } else {
        // doc/docx — binary formats need a conversion library, skip for now
        console.log(
          `[extract-file] Skipping unsupported format ${item.mimeType} for ${item.id}`
        );
        continue;
      }

      if (extractedText) {
        await db
          .update(observationMedia)
          .set({ aiExtractedText: extractedText })
          .where(eq(observationMedia.id, item.id));
      }
    } catch (error) {
      console.error(
        `[extract-file] Failed to extract text from ${item.id}:`,
        error
      );
    }
  }
}

async function extractPlainText(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const text = await response.text();
  return text.slice(0, MAX_EXTRACTED_LENGTH);
}

async function extractPdfText(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const { text } = await generateText({
    model: getMediaDescriptionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the key text content from this PDF. Focus on the main content, summarising if long. Return the extracted text, not a description of the document.",
          },
          {
            type: "file",
            data: base64,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  return text.slice(0, MAX_EXTRACTED_LENGTH);
}

async function extractImageText(url: string): Promise<string | null> {
  const { text } = await generateText({
    model: getMediaDescriptionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable text from this image exactly as written. Include handwriting, printed text, labels, sticky notes, whiteboard content, and any other visible text. If there is no readable text, respond with exactly: NO_TEXT",
          },
          {
            type: "image",
            image: url,
          },
        ],
      },
    ],
  });

  if (text.trim() === "NO_TEXT") return null;
  return text.slice(0, MAX_EXTRACTED_LENGTH);
}
