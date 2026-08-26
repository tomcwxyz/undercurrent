import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
import {
  AgentApiError,
  agentApiErrorResponse,
  requirePilotAgentUser,
  requirePilotSpaceMembership,
} from "@/lib/agent-api";

const listSchema = z.object({
  spaceId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(request: Request) {
  try {
    const user = await requirePilotAgentUser(request);
    const url = new URL(request.url);
    const parsed = listSchema.safeParse({
      spaceId: url.searchParams.get("spaceId"),
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) throw new AgentApiError(parsed.error.issues[0].message, 400);

    await requirePilotSpaceMembership(user.id, parsed.data.spaceId);
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
        status: signals.status,
        sentiment: signals.sentiment,
        humanValidated: signals.humanValidated,
      })
      .from(signals)
      .where(eq(signals.spaceId, parsed.data.spaceId))
      .orderBy(desc(signals.lastUpdated))
      .limit(parsed.data.limit);

    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return agentApiErrorResponse(error);
  }
}
