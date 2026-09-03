import { z } from "zod";
import {
  ApiV1Error,
  apiV1ErrorResponse,
  requireApiV1Key,
  requireApiV1SpaceMembership,
} from "@/lib/api-v1";
import {
  getObservationsWithSentiment,
  getSignalsForSpace,
} from "@/lib/db/queries";
import { toSentimentViewData, toSignalView } from "@/lib/db/transforms";
import {
  buildSwellsSemanticScene,
  projectSwellsSurface,
} from "@/lib/surfaces/project";

const querySchema = z.object({
  spaceId: z.string().uuid(),
  surface: z.enum(["web", "r1", "tablet", "epaper"]).default("tablet"),
});

/**
 * Read-only surface scene for first-party device clients and Attention.
 *
 * The scene carries the real Swells temperature and signal semantics, rather
 * than asking another product to reconstruct them from raw observations.
 * Observation snippets are deliberately stripped from temperature cells: this
 * endpoint is an aggregate presentation contract, not an evidence-export API.
 */
export async function GET(request: Request) {
  try {
    const principal = await requireApiV1Key(request, "signals:read");
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      spaceId: url.searchParams.get("spaceId"),
      surface: url.searchParams.get("surface") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiV1Error(
        parsed.error.issues[0]?.message ?? "Invalid query",
        400,
        "invalid_request",
      );
    }

    await requireApiV1SpaceMembership(principal.user.id, parsed.data.spaceId);

    const [signalRows, sentimentRows] = await Promise.all([
      getSignalsForSpace(parsed.data.spaceId),
      getObservationsWithSentiment(parsed.data.spaceId),
    ]);

    const scene = buildSwellsSemanticScene({
      spaceId: parsed.data.spaceId,
      signals: signalRows.map(toSignalView),
      sentiment: toSentimentViewData(sentimentRows),
    });
    const projection = projectSwellsSurface(scene, parsed.data.surface);

    const temperature = {
      ...projection.temperature,
      cells: projection.temperature.cells.map((cell) => ({
        ...cell,
        observations: [],
      })),
    };

    return Response.json(
      {
        data: {
          ...projection,
          temperature,
        },
        meta: {
          version: "v1",
          semanticContract: "swells-surface-scene",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}
