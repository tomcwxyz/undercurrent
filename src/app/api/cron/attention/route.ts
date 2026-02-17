import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { runAttentionAnalysis } from "@/lib/ai/tasks/attention";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run attention analysis for all active spaces
    const allSpaces = await db.select({ id: spaces.id }).from(spaces);

    const results = await Promise.allSettled(
      allSpaces.map((space) => runAttentionAnalysis(space.id))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      spaces: allSpaces.length,
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
