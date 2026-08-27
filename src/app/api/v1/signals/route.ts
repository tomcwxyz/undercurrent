import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
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

export async function GET(request: Request) {
  try {
    const principal = await requireApiV1Key(request, "signals:read");
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
          lt(signals.lastUpdated, cursor.at),
          and(eq(signals.lastUpdated, cursor.at), lt(signals.id, cursor.id)),
        )
      : undefined;

    const data = await db
      .select({
        id: signals.id,
        title: signals.title,
        description: signals.description,
        strength: signals.strength,
        direction: signals.direction,
        observationCount: signals.observationCount,
        contributorCount: signals.contributorCount,
        firstSeen: signals.firstSeen,
        lastUpdated: signals.lastUpdated,
        sentiment: signals.sentiment,
        humanValidated: signals.humanValidated,
      })
      .from(signals)
      .where(
        and(
          eq(signals.spaceId, parsed.data.spaceId),
          eq(signals.status, "active"),
          cursorWhere,
        ),
      )
      .orderBy(desc(signals.lastUpdated), desc(signals.id))
      .limit(parsed.data.limit);

    const last = data[data.length - 1];
    const nextCursor =
      data.length === parsed.data.limit && last
        ? encodeApiV1Cursor(last.lastUpdated, last.id)
        : null;

    return Response.json(
      { data, meta: { version: "v1", nextCursor } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}
