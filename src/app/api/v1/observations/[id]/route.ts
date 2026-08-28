import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import {
  ApiV1Error,
  apiV1ErrorResponse,
  requireApiV1Key,
  requireApiV1SpaceMembership,
} from "@/lib/api-v1";

const querySchema = z.object({
  spaceId: z.string().uuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireApiV1Key(request, "observations:read");
    const { id } = await params;
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      spaceId: url.searchParams.get("spaceId"),
    });

    if (!parsed.success) {
      throw new ApiV1Error(
        parsed.error.issues[0]?.message ?? "Invalid query",
        400,
        "invalid_request",
      );
    }

    await requireApiV1SpaceMembership(principal.user.id, parsed.data.spaceId);

    const [observation] = await db
      .select({
        id: observations.id,
        spaceId: observations.spaceId,
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
          eq(observations.id, id),
          eq(observations.spaceId, parsed.data.spaceId),
          eq(observations.moderationStatus, "approved"),
        ),
      )
      .limit(1);

    if (!observation) {
      throw new ApiV1Error(
        "Observation not found",
        404,
        "observation_not_found",
      );
    }

    return Response.json(
      { data: observation, meta: { version: "v1" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}
