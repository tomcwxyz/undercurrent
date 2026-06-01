// One-off backfill: run reflection-derived observations that were migrated
// (never AI-processed) through the real pipeline, so they get embedded +
// enriched and their signal(s) re-synthesised — exactly as a freshly submitted
// response would. Run from app/:
//   npx tsx scripts/backfill-reflection-pipeline.ts
//
// Env is loaded explicitly first, then the app modules are imported
// dynamically so @/lib/db reads DATABASE_URL after it's set.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const { observations, reflections } = await import("@/lib/db/schema");
  const { processReflectionResponse } = await import("@/lib/ai/pipeline");
  const { and, eq, isNull, isNotNull } = await import("drizzle-orm");

  const pending = await db
    .select({
      id: observations.id,
      spaceId: observations.spaceId,
      reflectionId: observations.reflectionId,
    })
    .from(observations)
    .where(and(isNotNull(observations.reflectionId), isNull(observations.aiProcessedAt)));

  console.log(`Found ${pending.length} unprocessed reflection response(s).`);

  for (const row of pending) {
    const [reflection] = await db
      .select({ signalIds: reflections.signalIds })
      .from(reflections)
      .where(eq(reflections.id, row.reflectionId!))
      .limit(1);
    const signalIds = (reflection?.signalIds as string[] | null) ?? [];
    console.log(`→ Processing ${row.id} (signals: ${signalIds.join(", ") || "none"})`);
    await processReflectionResponse(row.id, row.spaceId, signalIds);
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
