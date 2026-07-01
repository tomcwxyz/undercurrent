import { NextRequest, NextResponse } from "next/server";
import { getStuckObservations } from "@/lib/db/queries";
import { processObservation } from "@/lib/ai/pipeline";

// Reprocessing runs the full AI pipeline per observation, so give the handler
// headroom and keep the batch small to avoid a provider-rate-limit burst.
export const maxDuration = 300;

const BATCH_SIZE = 10;

/**
 * Retry observations that never embedded (e.g. a transient provider outage
 * during their original `after()` run left them aiEmbedding-null and
 * unprocessed). Runs on a schedule so nothing is silently stranded.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stuck = await getStuckObservations(BATCH_SIZE);
    let reprocessed = 0;
    for (const obs of stuck) {
      try {
        await processObservation(obs.id, obs.spaceId);
        reprocessed++;
      } catch (error) {
        console.error(`[cron/reprocess] Failed to reprocess ${obs.id}:`, error);
      }
    }
    return NextResponse.json({ ok: true, found: stuck.length, reprocessed });
  } catch (error) {
    console.error("[cron/reprocess] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
