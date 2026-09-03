import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
import { surfaceFeedback } from "@/lib/db/surface-schema";
import { getMemberRole } from "@/lib/db/queries";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  signalId: z.string().uuid().optional(),
  kind: z.enum(["ask_answer", "signal_interpretation"]),
  judgement: z.enum([
    "useful",
    "not_useful",
    "fits",
    "does_not_fit",
    "important",
    "weak",
    "split",
    "changed_mind",
    "stop_showing",
  ]),
  question: z.string().max(400).optional(),
  answer: z.string().max(1400).optional(),
  evidenceIds: z.array(z.string().uuid()).max(10).default([]),
  note: z.string().max(500).optional(),
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
      { error: parsed.error.issues[0]?.message ?? "Invalid feedback" },
      { status: 400 },
    );
  }

  const role = await getMemberRole(session.user.id, parsed.data.spaceId);
  if (!role) {
    return Response.json({ error: "Not authorised for this space" }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    `r1-feedback:${session.user.id}`,
    120,
    60 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json({ error: "Too much feedback too quickly" }, { status: 429 });
  }

  if (parsed.data.signalId) {
    const [signal] = await db
      .select({ id: signals.id })
      .from(signals)
      .where(
        and(
          eq(signals.id, parsed.data.signalId),
          eq(signals.spaceId, parsed.data.spaceId),
        ),
      )
      .limit(1);

    if (!signal) {
      return Response.json({ error: "Signal not found" }, { status: 404 });
    }
  }

  try {
    const [saved] = await db
      .insert(surfaceFeedback)
      .values({
        userId: session.user.id,
        spaceId: parsed.data.spaceId,
        signalId: parsed.data.signalId,
        surface: "r1",
        kind: parsed.data.kind,
        judgement: parsed.data.judgement,
        question: parsed.data.question,
        answer: parsed.data.answer,
        evidenceIds: parsed.data.evidenceIds,
        note: parsed.data.note,
        metadata: parsed.data.metadata ?? {},
      })
      .returning({ id: surfaceFeedback.id });

    return Response.json(
      { data: { id: saved.id } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (cause) {
    console.error("[r1/feedback] failed", cause);
    return Response.json(
      { error: "Swells could not record that feedback." },
      { status: 500 },
    );
  }
}
