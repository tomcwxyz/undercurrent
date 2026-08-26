import { after } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { incrementObservationCount } from "@/lib/db/queries";
import { processObservation } from "@/lib/ai/pipeline";
import { canCreateObservation } from "@/lib/permissions";
import {
  checkObservationLimit,
  checkSubscriptionAccess,
} from "@/lib/stripe";
import type { SpaceRole } from "@/lib/types";
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

const createSchema = z.object({
  spaceId: z.string().uuid(),
  text: z.string().trim().min(1).max(5000),
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
        id: observations.id,
        createdAt: observations.createdAt,
        authorName: observations.authorName,
        contentText: observations.contentText,
        aiSentiment: observations.aiSentiment,
        aiThemes: observations.aiThemes,
        signalStrength: observations.signalStrength,
        aiEntities: observations.aiEntities,
      })
      .from(observations)
      .where(eq(observations.spaceId, parsed.data.spaceId))
      .orderBy(desc(observations.createdAt))
      .limit(parsed.data.limit);

    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return agentApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePilotAgentUser(request);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new AgentApiError(parsed.error.issues[0].message, 400);

    const membership = await requirePilotSpaceMembership(user.id, parsed.data.spaceId);
    if (!canCreateObservation(membership.role as SpaceRole)) {
      throw new AgentApiError("Not authorized to create observations in this space", 403);
    }

    const access = await checkSubscriptionAccess(user.id, user.email);
    if (!access.allowed) {
      throw new AgentApiError(`Subscription ${access.reason}`, 403);
    }

    const { ok: withinLimit, subscription } = await checkObservationLimit(
      user.id,
      user.email,
    );
    if (!withinLimit) throw new AgentApiError("Monthly observation limit reached", 429);

    const [observation] = await db
      .insert(observations)
      .values({
        spaceId: parsed.data.spaceId,
        authorId: user.id,
        authorName: user.name ?? "Anonymous",
        contentText: parsed.data.text,
        signalStrength: "single",
      })
      .returning({
        id: observations.id,
        createdAt: observations.createdAt,
        contentText: observations.contentText,
      });

    if (subscription) {
      await incrementObservationCount(subscription.id, parsed.data.spaceId);
    }

    after(() => processObservation(observation.id, parsed.data.spaceId));
    return Response.json({ data: observation }, { status: 201 });
  } catch (error) {
    return agentApiErrorResponse(error);
  }
}
