// One-off migration: move existing `reflection_responses` rows into
// `observations` (linked via reflection_id) so they survive the model change
// where reflection responses are unified as observations.
//
// Run from the app/ directory:
//   node --env-file=.env.local scripts/migrate-reflection-responses.mjs
//
// Idempotent: skips any response that already has a matching observation
// (same reflection_id + content_text + created_at). Migrated rows are NOT
// re-run through the AI pipeline — they display in Reflect + River but are not
// re-embedded or linked to signals.

import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/migrate-reflection-responses.mjs");
  process.exit(1);
}

const sql = neon(dbUrl);

const inserted = await sql`
  INSERT INTO observations (
    author_id, author_name, space_id, content_text,
    signal_strength, moderation_status, reflection_id, created_at
  )
  SELECT
    rr.user_id, rr.author_name, r.space_id, rr.text,
    'single', 'approved', rr.reflection_id, rr.created_at
  FROM reflection_responses rr
  JOIN reflections r ON r.id = rr.reflection_id
  WHERE NOT EXISTS (
    SELECT 1 FROM observations o
    WHERE o.reflection_id = rr.reflection_id
      AND o.content_text = rr.text
      AND o.created_at = rr.created_at
  )
  RETURNING id
`;

console.log(`Migrated ${inserted.length} reflection response(s) into observations.`);
process.exit(0);
