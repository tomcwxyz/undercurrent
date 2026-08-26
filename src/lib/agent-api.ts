import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaceMemberships, users } from "@/lib/db/schema";

export class AgentApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function safeTokenEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function requirePilotAgentUser(request: Request) {
  const expectedToken = process.env.SWELLS_AGENT_API_TOKEN?.trim();
  const userEmail = process.env.SWELLS_AGENT_USER_EMAIL?.trim().toLowerCase();
  if (!expectedToken || !userEmail) {
    throw new AgentApiError("Swells agent pilot is not configured", 503);
  }

  const header = request.headers.get("authorization");
  const suppliedToken = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!suppliedToken || !safeTokenEqual(suppliedToken, expectedToken)) {
    throw new AgentApiError("Invalid or missing agent token", 401);
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1);

  if (!user) throw new AgentApiError("Configured agent user does not exist", 503);
  return user;
}

export async function requirePilotSpaceMembership(userId: string, spaceId: string) {
  const [membership] = await db
    .select({ role: spaceMemberships.role })
    .from(spaceMemberships)
    .where(
      and(
        eq(spaceMemberships.userId, userId),
        eq(spaceMemberships.spaceId, spaceId),
      ),
    )
    .limit(1);

  if (!membership) throw new AgentApiError("Not authorized for this space", 403);
  return membership;
}

export function agentApiErrorResponse(error: unknown) {
  if (error instanceof AgentApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Swells agent API error", error);
  return Response.json({ error: "Agent API request failed" }, { status: 500 });
}
