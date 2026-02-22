import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { observationMedia } from "@/lib/db/schema";
import { getMediaForObservation } from "@/lib/db/queries";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/** Transcribe voice attachments on an observation via Whisper */
export async function transcribeVoiceForObservation(
  observationId: string
): Promise<void> {
  const media = await getMediaForObservation(observationId);
  const voiceClips = media.filter(
    (m) => m.type === "voice" && !m.aiTranscript
  );

  if (voiceClips.length === 0) return;

  const openai = getOpenAI();

  for (const clip of voiceClips) {
    try {
      // Fetch audio from R2
      const response = await fetch(clip.url);
      if (!response.ok) {
        console.error(`[transcribe] Failed to fetch audio ${clip.id}: ${response.status}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const ext = clip.mimeType?.includes("webm") ? "webm" : "ogg";
      const file = new File([arrayBuffer], `voice.${ext}`, {
        type: clip.mimeType || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
      });

      if (transcription.text) {
        await db
          .update(observationMedia)
          .set({ aiTranscript: transcription.text })
          .where(eq(observationMedia.id, clip.id));
      }
    } catch (error) {
      console.error(
        `[transcribe] Failed to transcribe voice ${clip.id}:`,
        error
      );
      // Continue with remaining clips
    }
  }
}
