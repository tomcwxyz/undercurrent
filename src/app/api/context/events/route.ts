import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { spaceMemberships, users } from "@/lib/db/schema";
import { contextPrompts } from "@/lib/db/context-schema";
import { contextEventSchema } from "@/lib/context/types";
import { buildSwellsSensingPrompt } from "@/lib/context/swells";
import { verifyContextDelivery } from "@/lib/context/signature";

const deliverySchema = z.object({
  spaceId: z.string().uuid(),
  event: contextEventSchema,
});

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-context-timestamp");
  const signature = request.headers.get("x-context-signature");

  try {
    if (!verifyContextDelivery(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid context signature" }, { status: 401 });
    }
  } catch (error) {
    console.error("Context ingest signature configuration error", error);
    return NextResponse.json({ error: "Context ingest is not configured" }, { status: 503 });
  }

  let parsed: z.infer<typeof deliverySchema>;
  try {
    parsed = deliverySchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid context event" }, { status: 422 });
  }

  const accountEmail = parsed.event.source.accountId.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, accountEmail))
    .limit(1);

  if (!user) {
    // Do not create a shadow account from an external feed. The shared identity
    // layer can solve cross-account mapping later; the pilot requires the
    // connected Google account to match an existing Swells login email.
    return NextResponse.json({ accepted: true, routed: false, reason: "no_user" });
  }

  const [membership] = await db
    .select({ role: spaceMemberships.role })
    .from(spaceMemberships)
    .where(
      and(
        eq(spaceMemberships.userId, user.id),
        eq(spaceMemberships.spaceId, parsed.spaceId),
      ),
    )
    .limit(1);

  if (!membership || membership.role === "viewer") {
    return NextResponse.json({ accepted: true, routed: false, reason: "no_access" });
  }

  const interpretation = buildSwellsSensingPrompt(parsed.event);
  if (!interpretation) {
    return NextResponse.json({ accepted: true, routed: false, reason: "not_relevant" });
  }

  const [existing] = await db
    .select({ id: contextPrompts.id, status: contextPrompts.status })
    .from(contextPrompts)
    .where(
      and(
        eq(contextPrompts.userId, user.id),
        eq(contextPrompts.spaceId, parsed.spaceId),
        eq(contextPrompts.externalEventId, parsed.event.id),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(contextPrompts).values({
      userId: user.id,
      spaceId: parsed.spaceId,
      externalEventId: parsed.event.id,
      sourceProvider: parsed.event.source.provider,
      event: parsed.event,
      interpretation,
    });
    return NextResponse.json({ accepted: true, routed: true, created: true });
  }

  // Calendar edits may improve the context while the prompt is waiting, but a
  // repeat delivery must never resurrect something the user dismissed or kept.
  if (existing.status === "pending") {
    await db
      .update(contextPrompts)
      .set({
        event: parsed.event,
        interpretation,
        updatedAt: new Date(),
      })
      .where(eq(contextPrompts.id, existing.id));
  }

  return NextResponse.json({ accepted: true, routed: true, created: false });
}
