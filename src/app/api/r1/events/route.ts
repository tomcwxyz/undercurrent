import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { surfaceInteractionEvents } from "@/lib/db/surface-schema";
import { getMemberRole } from "@/lib/db/queries";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  sessionId: z.string().min(8).max(100),
  event: z.enum([
    "surface_open",
    "lens_view",
    "navigate",
    "capture_saved",
    "capture_review_opened",
    "capture_reviewed",
  ]),
  lens: z.string().max(40).optional(),
  signalId: z.string().uuid().optional(),
  observationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid event" },
      { status: 400 },
    );
  }

  const role = await getMemberRole(session.user.id, parsed.data.spaceId);
  if (!role) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    `r1-events:${session.user.id}`,
    900,
    60 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json({ error: "Event limit reached" }, { status: 429 });
  }

  await db.insert(surfaceInteractionEvents).values({
    userId: session.user.id,
    spaceId: parsed.data.spaceId,
    signalId: parsed.data.signalId,
    observationId: parsed.data.observationId,
    surface: "r1",
    sessionId: parsed.data.sessionId,
    event: parsed.data.event,
    lens: parsed.data.lens,
    metadata: parsed.data.metadata ?? {},
  });

  return new Response(null, { status: 204 });
}
