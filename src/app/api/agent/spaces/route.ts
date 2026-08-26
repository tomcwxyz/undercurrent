import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaceMemberships, spaces } from "@/lib/db/schema";
import { agentApiErrorResponse, requirePilotAgentUser } from "@/lib/agent-api";

export async function GET(request: Request) {
  try {
    const user = await requirePilotAgentUser(request);
    const data = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        description: spaces.description,
        type: spaces.type,
        role: spaceMemberships.role,
      })
      .from(spaceMemberships)
      .innerJoin(spaces, eq(spaces.id, spaceMemberships.spaceId))
      .where(eq(spaceMemberships.userId, user.id));

    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return agentApiErrorResponse(error);
  }
}
