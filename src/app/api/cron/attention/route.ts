import { NextRequest, NextResponse } from "next/server";
import { runAttentionAnalysis } from "@/lib/ai/tasks/attention";
import { getActiveSpaceIdsSince } from "@/lib/db/queries";
import { AI_CONFIG } from "@/lib/ai/config";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only analyse spaces with recent activity — skip dormant/empty ones so we
    // don't spend on quiet spaces.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AI_CONFIG.attention.lookbackDays);
    const activeSpaceIds = await getActiveSpaceIdsSince(cutoff, AI_CONFIG.attention.minObservations);

    const results = await Promise.allSettled(
      activeSpaceIds.map((id) => runAttentionAnalysis(id))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      analysed: activeSpaceIds.length,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("[cron/attention] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
