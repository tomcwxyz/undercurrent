import { z } from "zod";
import { auth } from "@/lib/auth";
import { askSignal } from "@/lib/ai/tasks/ask-signal";
import { getMemberRole } from "@/lib/db/queries";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubscriptionAccess } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  signalId: z.string().uuid(),
  question: z.string().trim().min(2).max(400),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const access = await checkSubscriptionAccess(
    session.user.id,
    session.user.email,
  );
  if (!access.allowed) {
    return Response.json(
      { error: `Subscription ${access.reason}` },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const role = await getMemberRole(session.user.id, parsed.data.spaceId);
  if (!role) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    `r1-ask:${session.user.id}`,
    30,
    15 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json(
      { error: "Too many questions. Try again in a little while." },
      { status: 429 },
    );
  }

  try {
    const result = await askSignal(parsed.data);
    return Response.json(
      { data: result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const notFound = message === "Signal not found";
    console.error("[r1/ask] failed", {
      userId: session.user.id,
      spaceId: parsed.data.spaceId,
      signalId: parsed.data.signalId,
      message,
    });
    return Response.json(
      { error: notFound ? "Signal not found" : "Swells could not answer that yet." },
      { status: notFound ? 404 : 500 },
    );
  }
}
