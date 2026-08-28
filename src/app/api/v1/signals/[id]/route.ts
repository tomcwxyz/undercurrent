import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
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
    const principal = await requireApiV1Key(request, "signals:read");
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

    const [signal] = await db
      .select({
        id: signals.id,
        spaceId: signals.spaceId,
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
          eq(signals.id, id),
          eq(signals.spaceId, parsed.data.spaceId),
          eq(signals.status, "active"),
        ),
      )
      .limit(1);

    if (!signal) {
      throw new ApiV1Error("Signal not found", 404, "signal_not_found");
    }

    return Response.json(
      { data: signal, meta: { version: "v1" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}
