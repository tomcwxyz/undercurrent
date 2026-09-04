import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observationMedia, observations } from "@/lib/db/schema";
import { getMemberRole, incrementObservationCount } from "@/lib/db/queries";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import {
  IMAGE_OBSERVATION_PLACEHOLDER,
  processObservation,
} from "@/lib/ai/pipeline";
import {
  checkObservationLimit,
  checkSubscriptionAccess,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mediaRefSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["image", "voice", "file"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().nonnegative(),
});

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  text: z.string().max(5000).optional(),
  media: z.array(mediaRefSchema).max(8).optional().default([]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid observation" },
      { status: 400 },
    );
  }

  const text = parsed.data.text?.trim() ?? "";
  if (!text && parsed.data.media.length === 0) {
    return Response.json(
      { error: "Add a note or a recording first." },
      { status: 400 },
    );
  }

  const role = await getMemberRole(session.user.id, parsed.data.spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) {
    return Response.json(
      { error: `Subscription ${access.reason}` },
      { status: 402 },
    );
  }

  const { ok, subscription } = await checkObservationLimit(
    session.user.id,
    session.user.email,
  );
  if (!ok) {
    return Response.json({ error: "Monthly observation limit reached" }, { status: 429 });
  }

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: parsed.data.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: text || IMAGE_OBSERVATION_PLACEHOLDER,
      signalStrength: "single",
    })
    .returning({ id: observations.id });

  if (parsed.data.media.length) {
    await db.insert(observationMedia).values(
      parsed.data.media.map((media) => ({
        observationId: inserted.id,
        type: media.type,
        storageKey: media.key,
        url: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
      })),
    );
  }

  if (subscription) {
    await incrementObservationCount(subscription.id, parsed.data.spaceId);
  }

  after(() => processObservation(inserted.id, parsed.data.spaceId));

  return Response.json({ data: { id: inserted.id } }, { status: 201 });
}
