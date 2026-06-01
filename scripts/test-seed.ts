// Verifies seedDemoData runs cleanly and produces rich, well-linked data,
// then deletes the created space so nothing is left behind.
//   npx tsx scripts/test-seed.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const { seedDemoData } = await import("@/lib/db/seed");
  const sql = neon(process.env.DATABASE_URL!);

  // Use an explicit user id (argv) or fall back to the first user in the DB.
  const [firstUser] = await sql`SELECT id FROM users ORDER BY 1 LIMIT 1`;
  const userId = process.argv[2] ?? firstUser?.id;
  if (!userId) throw new Error("No user id available to seed against");

  console.log("Seeding for user", userId, "…");
  const spaceId = await seedDemoData(userId);
  console.log("Created space", spaceId);

  try {
    const [obs] = await sql`SELECT
      count(*) AS total,
      count(*) FILTER (WHERE ai_sentiment_data IS NOT NULL) AS with_sentiment,
      count(*) FILTER (WHERE ai_themes IS NOT NULL AND jsonb_array_length(ai_themes) > 0) AS with_themes,
      count(*) FILTER (WHERE collection_id IS NOT NULL) AS from_collections,
      count(*) FILTER (WHERE reflection_id IS NOT NULL) AS from_reflections,
      count(*) FILTER (WHERE moderation_status = 'pending') AS pending,
      min(created_at)::date AS earliest, max(created_at)::date AS latest
      FROM observations WHERE space_id = ${spaceId}`;
    const [media] = await sql`SELECT count(*) AS images FROM observation_media m JOIN observations o ON o.id = m.observation_id WHERE o.space_id = ${spaceId}`;
    const sig = await sql`SELECT title, strength, direction, observation_count, contributor_count FROM signals WHERE space_id = ${spaceId} ORDER BY observation_count DESC`;
    const [junc] = await sql`SELECT count(*) AS links FROM signal_observations so JOIN signals s ON s.id = so.signal_id WHERE s.space_id = ${spaceId}`;
    const [nodes] = await sql`SELECT count(*) AS total, count(*) FILTER (WHERE signal_id IS NOT NULL) AS linked FROM constellation_nodes WHERE space_id = ${spaceId}`;
    const cols = await sql`SELECT title, is_open, response_count, moderation_enabled FROM collections WHERE space_id = ${spaceId}`;
    const [refl] = await sql`SELECT count(*) AS total FROM reflections WHERE space_id = ${spaceId}`;
    const [snaps] = await sql`SELECT count(*) AS total FROM signal_snapshots sn JOIN signals s ON s.id = sn.signal_id WHERE s.space_id = ${spaceId}`;
    const themes = await sql`SELECT t AS theme, count(*) AS n FROM observations o, jsonb_array_elements_text(o.ai_themes) t WHERE o.space_id = ${spaceId} GROUP BY t ORDER BY n DESC LIMIT 6`;

    console.log("\n── Observations ──");
    console.log(obs);
    console.log("images:", media.images);
    console.log("\n── Signals ──");
    for (const s of sig) console.log(`  ${s.observation_count}obs/${s.contributor_count}ppl  ${s.strength}/${s.direction}  ${s.title}`);
    console.log("signal_observation links:", junc.links);
    console.log("\n── Constellation ──", nodes);
    console.log("\n── Collections ──");
    for (const c of cols) console.log(`  "${c.title}"  open=${c.is_open} responses=${c.response_count} moderated=${c.moderation_enabled}`);
    console.log("reflections:", refl.total, "| snapshots:", snaps.total);
    console.log("\n── Top themes (terrain bands) ──", JSON.stringify(themes));
  } finally {
    await sql`DELETE FROM spaces WHERE id = ${spaceId}`;
    console.log("\nDeleted test space (cascade). Clean.");
  }
  process.exit(0);
}

main().catch((e) => { console.error("Seed test failed:", e); process.exit(1); });
