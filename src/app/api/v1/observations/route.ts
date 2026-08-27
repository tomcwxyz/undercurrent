import { after } from "next/server";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { incrementObservationCount } from "@/lib/db/queries";
import { processObservation } from "@/lib/ai/pipeline";
import { canCreateObservation } from "@/lib/permissions";
import { checkObservationLimit, checkSubscriptionAccess } from "@/lib/stripe";
import type { SpaceRole } from "@/lib/types";
import {
  ApiV1Error,
  apiV1ErrorResponse,
  decodeApiV1Cursor,
  encodeApiV1Cursor,
  requireApiV1Key,
  requireApiV1SpaceMembership,
} from "@/lib/api-v1";

const listSchema = z.object({
  spaceId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).optional(),
});

const createSchema = z.object({
  spaceId: z.string().uuid(),
  text: z.string().trim().min(1).max(5000),
});

export async function GET(request: Request) {
  try {
    const principal = await requireApiV1Key(request, "observations:read");
    const url = new URL(request.url);
    const parsed = listSchema.safeParse({
      spaceId: url.searchParams.get("spaceId"),
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiV1Error(
        parsed.error.issues[0]?.message ?? "Invalid query",
        400,
        "invalid_request",
      );
    }

    await requireApiV1SpaceMembership(principal.user.id, parsed.data.spaceId);
    const cursor = parsed.data.cursor
      ? decodeApiV1Cursor(parsed.data.cursor)
      : null;
    const cursorWhere = cursor
      ? or(
          lt(observations.createdAt, cursor.at),
          and(
            eq(observations.createdAt, cursor.at),
            lt(observations.id, cursor.id),
          ),
        )
      : undefined;

    const data = await db
      .select({
        id: observations.id,
        createdAt: observations.createdAt,
        authorName: observations.authorName,
        contentText: observations.contentText,
        aiSentiment: observations.aiSentiment,
        aiThemes: observations.aiThemes,
        aiEntities: observations.aiEntities,
        signalStrength: observations.signalStrength,
        collectionId: observations.collectionId,
        reflectionId: observations.reflectionId,
        aiProcessedAt: observations.aiProcessedAt,
      })
      .from(observations)
      .where(
        and(
          eq(observations.spaceId, parsed.data.spaceId),
          eq(observations.moderationStatus, "approved"),
          cursorWhere,
        ),
      )
      .orderBy(desc(observations.createdAt), desc(observations.id))
      .limit(parsed.data.limit);

    const last = data[data.length - 1];
    const nextCursor =
      data.length === parsed.data.limit && last
        ? encodeApiV1Cursor(last.createdAt, last.id)
        : null;

    return Response.json(
      { data, meta: { version: "v1", nextCursor } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireApiV1Key(request, "observations:write");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiV1Error("Invalid JSON", 400, "invalid_request");
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiV1Error(
        parsed.error.issues[0]?.message ?? "Invalid request",
        400,
        "invalid_request",
      );
    }

    const membership = await requireApiV1SpaceMembership(
      principal.user.id,
      parsed.data.spaceId,
    );
    if (!canCreateObservation(membership.role as SpaceRole)) {
      throw new ApiV1Error(
        "Not authorised to create observations in this space",
        403,
        "space_forbidden",
      );
    }

    const access = await checkSubscriptionAccess(
      principal.user.id,
      principal.user.email,
    );
    if (!access.allowed) {
      throw new ApiV1Error(
        "Subscription does not currently allow new observations",
        403,
        "subscription_required",
      );
    }

    const { ok: withinLimit, subscription } = await checkObservationLimit(
      principal.user.id,
      principal.user.email,
    );
    if (!withinLimit) {
      throw new ApiV1Error(
        "Monthly observation limit reached",
        429,
        "observation_limit_reached",
      );
    }

    const [observation] = await db
      .insert(observations)
      .values({
        spaceId: parsed.data.spaceId,
        authorId: principal.user.id,
        authorName: principal.user.name ?? "Anonymous",
        contentText: parsed.data.text,
        signalStrength: "single",
      })
      .returning({
        id: observations.id,
        createdAt: observations.createdAt,
        contentText: observations.contentText,
        aiProcessedAt: observations.aiProcessedAt,
      });

    if (subscription) {
      await incrementObservationCount(subscription.id, parsed.data.spaceId);
    }

    after(async () => {
      await processObservation(observation.id, parsed.data.spaceId);
    });

    return Response.json(
      { data: observation, meta: { version: "v1" } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}
