import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations, observationMedia } from "@/lib/db/schema";
import {
  getCollectionByToken,
  incrementCollectionResponseCount,
} from "@/lib/db/queries";
import { processObservation, IMAGE_OBSERVATION_PLACEHOLDER } from "@/lib/ai/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";

const submitSchema = z.object({
  text: z.string().max(5000).optional(),
  name: z.string().max(100).optional(),
  mediaRefs: z.array(z.object({
    key: z.string(),
    url: z.string(),
    type: z.enum(["image", "voice", "file"]),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
  })).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!(await checkRateLimit(`submit:${ip}:${token}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const collection = await getCollectionByToken(token);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.isOpen) return NextResponse.json({ error: "Closed" }, { status: 403 });
  if (collection.closeAt && collection.closeAt < new Date()) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }
  if (collection.maxResponses && collection.responseCount >= collection.maxResponses) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }

  const body = submitSchema.parse(await req.json());
  const { text, name, mediaRefs } = body;

  const hasText = !!text?.trim();
  const hasMedia = mediaRefs.length > 0;
  if (!hasText && !hasMedia) {
    return NextResponse.json({ error: "Please add text or media" }, { status: 400 });
  }

  const moderationStatus = collection.moderationEnabled ? "pending" : "approved";
  const contentText = hasText ? text! : IMAGE_OBSERVATION_PLACEHOLDER;

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: collection.spaceId,
      collectionId: collection.id,
      authorName: name?.trim() || "Anonymous",
      contentText,
      signalStrength: "single",
      moderationStatus,
    })
    .returning({ id: observations.id });

  if (mediaRefs.length > 0) {
    await db.insert(observationMedia).values(
      mediaRefs.map((m) => ({
        observationId: inserted.id,
        type: m.type,
        storageKey: m.key,
        url: m.url,
        fileName: m.fileName,
        mimeType: m.mimeType,
        fileSize: m.fileSize,
      }))
    );
  }

  if (moderationStatus === "approved") {
    await incrementCollectionResponseCount(collection.id);
    after(async () => {
      await processObservation(inserted.id, collection.spaceId);
    });
  }

  return NextResponse.json({ success: true, moderated: moderationStatus === "pending" });
}
