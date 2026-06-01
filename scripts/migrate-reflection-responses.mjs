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

// Step 1: copy reflection_responses into observations (linked via reflection_id).
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

// Step 2: attach every reflection-derived observation to its reflection's
// signal(s), so it becomes part of that signal (mirrors the pre-link a new
// response gets). Idempotent via the composite PK / ON CONFLICT.
const linked = await sql`
  INSERT INTO signal_observations (signal_id, observation_id)
  SELECT s.signal_id::uuid, o.id
  FROM observations o
  JOIN reflections r ON r.id = o.reflection_id
  CROSS JOIN LATERAL jsonb_array_elements_text(r.signal_ids) AS s(signal_id)
  WHERE o.reflection_id IS NOT NULL
  ON CONFLICT DO NOTHING
  RETURNING signal_id
`;
console.log(`Created ${linked.length} signal link(s) for reflection responses.`);

// Step 3: recompute observation/contributor counts for any signal touched by a
// reflection-derived observation, so the new links are reflected in the UI.
// (AI re-synthesis of the signal's description is left to the live pipeline.)
const recomputed = await sql`
  UPDATE signals s SET
    observation_count = sub.cnt,
    contributor_count = sub.contrib,
    last_updated = now()
  FROM (
    SELECT so.signal_id,
           count(*) AS cnt,
           count(DISTINCT o.author_id) AS contrib
    FROM signal_observations so
    JOIN observations o ON o.id = so.observation_id
    GROUP BY so.signal_id
  ) sub
  WHERE s.id = sub.signal_id
    AND EXISTS (
      SELECT 1 FROM signal_observations so2
      JOIN observations o2 ON o2.id = so2.observation_id
      WHERE so2.signal_id = s.id AND o2.reflection_id IS NOT NULL
    )
  RETURNING s.id
`;
console.log(`Recomputed counts for ${recomputed.length} signal(s).`);
process.exit(0);
