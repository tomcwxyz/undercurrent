import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations, signalObservations, signals } from "@/lib/db/schema";
import { surfaceCaptureReviews } from "@/lib/db/surface-schema";
import { getMemberRole } from "@/lib/db/queries";
import { evolveSignal } from "@/lib/ai/tasks/synthesise";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const decisionSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(["keep_connection", "keep_separate"]),
});

async function getPendingReview(userId: string, spaceId: string) {
  const [review] = await db
    .select({
      id: surfaceCaptureReviews.id,
      createdAt: surfaceCaptureReviews.createdAt,
      observationId: surfaceCaptureReviews.observationId,
      status: surfaceCaptureReviews.status,
      contentText: observations.contentText,
      aiProcessedAt: observations.aiProcessedAt,
    })
    .from(surfaceCaptureReviews)
    .innerJoin(
      observations,
      eq(observations.id, surfaceCaptureReviews.observationId),
    )
    .where(
      and(
        eq(surfaceCaptureReviews.userId, userId),
        eq(surfaceCaptureReviews.spaceId, spaceId),
        eq(surfaceCaptureReviews.surface, "r1"),
        eq(surfaceCaptureReviews.status, "pending"),
      ),
    )
    .orderBy(desc(surfaceCaptureReviews.createdAt))
    .limit(1);

  if (!review) return null;

  const attached = await db
    .select({
      id: signals.id,
      title: signals.title,
      description: signals.description,
      strength: signals.strength,
      direction: signals.direction,
    })
    .from(signalObservations)
    .innerJoin(signals, eq(signals.id, signalObservations.signalId))
    .where(eq(signalObservations.observationId, review.observationId));

  return {
    id: review.id,
    observationId: review.observationId,
    createdAt: review.createdAt.toISOString(),
    processing: !review.aiProcessedAt,
    text:
      review.contentText === "[Processing media…]"
        ? ""
        : review.contentText,
    signals: attached,
  };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const spaceId = new URL(request.url).searchParams.get("spaceId");
  const parsedSpaceId = z.string().uuid().safeParse(spaceId);
  if (!parsedSpaceId.success) {
    return Response.json({ error: "Invalid space" }, { status: 400 });
  }

  const role = await getMemberRole(session.user.id, parsedSpaceId.data);
  if (!role) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  return Response.json(
    { data: await getPendingReview(session.user.id, parsedSpaceId.data) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid review decision" },
      { status: 400 },
    );
  }

  const allowed = await checkRateLimit(
    `r1-capture-review:${session.user.id}`,
    120,
    60 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json({ error: "Too many review actions" }, { status: 429 });
  }

  const [review] = await db
    .select({
      id: surfaceCaptureReviews.id,
      spaceId: surfaceCaptureReviews.spaceId,
      observationId: surfaceCaptureReviews.observationId,
      status: surfaceCaptureReviews.status,
      aiProcessedAt: observations.aiProcessedAt,
    })
    .from(surfaceCaptureReviews)
    .innerJoin(
      observations,
      eq(observations.id, surfaceCaptureReviews.observationId),
    )
    .where(
      and(
        eq(surfaceCaptureReviews.id, parsed.data.reviewId),
        eq(surfaceCaptureReviews.userId, session.user.id),
        eq(surfaceCaptureReviews.surface, "r1"),
      ),
    )
    .limit(1);

  if (!review) {
    return Response.json({ error: "Capture review not found" }, { status: 404 });
  }

  const role = await getMemberRole(session.user.id, review.spaceId);
  if (!role) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  if (review.status !== "pending") {
    return Response.json({ data: { alreadyReviewed: true } });
  }

  if (!review.aiProcessedAt) {
    return Response.json(
      { error: "Swells is still processing this observation." },
      { status: 409 },
    );
  }

  const attached = await db
    .select({ signalId: signalObservations.signalId })
    .from(signalObservations)
    .where(eq(signalObservations.observationId, review.observationId));
  const signalIds = [...new Set(attached.map((item) => item.signalId))];

  if (parsed.data.decision === "keep_separate" && signalIds.length) {
    await db
      .delete(signalObservations)
      .where(eq(signalObservations.observationId, review.observationId));
  }

  await db
    .update(surfaceCaptureReviews)
    .set({
      status: "reviewed",
      decision: parsed.data.decision,
      reviewedAt: new Date(),
    })
    .where(eq(surfaceCaptureReviews.id, review.id));

  if (parsed.data.decision === "keep_separate" && signalIds.length) {
    after(async () => {
      for (const signalId of signalIds) {
        try {
          const [remaining] = await db
            .select({ observationId: signalObservations.observationId })
            .from(signalObservations)
            .where(eq(signalObservations.signalId, signalId))
            .limit(1);

          if (remaining) {
            await evolveSignal(signalId, review.spaceId);
            continue;
          }

          const [signal] = await db
            .select({ aiGenerated: signals.aiGenerated })
            .from(signals)
            .where(eq(signals.id, signalId))
            .limit(1);

          if (signal?.aiGenerated) {
            await db.delete(signals).where(eq(signals.id, signalId));
          } else {
            await db
              .update(signals)
              .set({
                observationCount: 0,
                contributorCount: 0,
                strength: "weak",
                direction: "steady",
                lastUpdated: new Date(),
              })
              .where(eq(signals.id, signalId));
          }
        } catch (cause) {
          console.error("[r1/capture-review] could not reconcile signal", {
            signalId,
            cause,
          });
        }
      }
      revalidatePath("/dashboard", "layout");
      revalidatePath(`/r1/${review.spaceId}`);
    });
  }

  return Response.json({
    data: {
      reviewId: review.id,
      decision: parsed.data.decision,
      detachedSignalIds:
        parsed.data.decision === "keep_separate" ? signalIds : [],
    },
  });
}
