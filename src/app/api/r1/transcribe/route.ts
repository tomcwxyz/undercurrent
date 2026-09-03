import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubscriptionAccess } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const access = await checkSubscriptionAccess(
    session.user.id,
    session.user.email,
  );
  if (!access.allowed) {
    return Response.json(
      { error: `Subscription ${access.reason}` },
      { status: 403 },
    );
  }

  const allowed = await checkRateLimit(
    `r1-transcribe:${session.user.id}`,
    30,
    15 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json(
      { error: "Too many voice questions. Try again in a little while." },
      { status: 429 },
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ error: "Missing audio" }, { status: 400 });
  }

  const type = audio.type.split(";")[0].trim();
  if (!ALLOWED_TYPES.has(type)) {
    return Response.json({ error: "Unsupported audio type" }, { status: 400 });
  }
  if (!audio.size || audio.size > MAX_BYTES) {
    return Response.json({ error: "Audio is empty or too large" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audio,
      prompt: "A short spoken question about an emerging signal in Swells.",
    });

    const text = transcription.text?.trim();
    if (!text) {
      return Response.json({ error: "No speech was recognised" }, { status: 422 });
    }

    return Response.json(
      { text: text.slice(0, 400) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (cause) {
    console.error("[r1/transcribe] failed", cause);
    return Response.json(
      { error: "Swells could not transcribe that question." },
      { status: 500 },
    );
  }
}
