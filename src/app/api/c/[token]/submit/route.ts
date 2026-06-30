import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations, observationMedia } from "@/lib/db/schema";
import {
  getCollectionByToken,
  getCollectionSubmissionCount,
  getSpaceBillingContext,
  getObservationCountForSubscription,
  incrementCollectionResponseCount,
  incrementObservationCount,
} from "@/lib/db/queries";
import { processObservation, IMAGE_OBSERVATION_PLACEHOLDER } from "@/lib/ai/pipeline";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hasFreeAccess } from "@/lib/account";
import { checkSubscriptionAccess, getTierConfig } from "@/lib/stripe";
import { validateMediaRef } from "@/lib/uploads";

/** Absolute safety ceiling on total submissions (pending + approved) per
 *  collection, independent of the admin-set response cap. */
const COLLECTION_SUBMISSION_CAP = 1000;

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
  const ip = getClientIp(req);

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

  // Absolute ceiling on total submissions — caps pending spam under moderation,
  // which the approved-only responseCount above never closes.
  const submissionCount = await getCollectionSubmissionCount(collection.id);
  if (submissionCount >= COLLECTION_SUBMISSION_CAP) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }

  const body = submitSchema.parse(await req.json());
  const { text, name, mediaRefs } = body;

  const hasText = !!text?.trim();
  const hasMedia = mediaRefs.length > 0;
  if (!hasText && !hasMedia) {
    return NextResponse.json({ error: "Please add text or media" }, { status: 400 });
  }

  // Validate every media reference: allowed type/size, and a storage key under
  // THIS collection's prefix (so a submitter can't attach another space's
  // private objects — an IDOR guard).
  const keyPrefix = `collections/${token}/`;
  for (const ref of mediaRefs) {
    const result = validateMediaRef(ref, keyPrefix);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  // Charge submissions against the space owner's subscription: block when the
  // account is inactive or over its monthly observation allowance, so an
  // unauthenticated collection link can't run up the owner's AI bill.
  const billing = await getSpaceBillingContext(collection.spaceId);
  if (billing && !hasFreeAccess(billing.ownerEmail)) {
    const access = await checkSubscriptionAccess(billing.ownerId, billing.ownerEmail);
    if (!access.allowed) {
      return NextResponse.json(
        { error: "This collection isn't accepting responses right now." },
        { status: 403 }
      );
    }
    if (billing.subscriptionId && billing.tier) {
      const used = await getObservationCountForSubscription(billing.subscriptionId);
      if (used >= getTierConfig(billing.tier).observationLimit) {
        return NextResponse.json(
          { error: "This collection has reached its monthly limit." },
          { status: 403 }
        );
      }
    }
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

  // Only count + process approved submissions. Moderated ones are counted and
  // processed on approval (see moderateObservationAction).
  if (moderationStatus === "approved") {
    await incrementCollectionResponseCount(collection.id);
    if (billing?.subscriptionId) {
      await incrementObservationCount(billing.subscriptionId, collection.spaceId);
    }
    after(async () => {
      await processObservation(inserted.id, collection.spaceId);
    });
  }

  return NextResponse.json({ success: true, moderated: moderationStatus === "pending" });
}
