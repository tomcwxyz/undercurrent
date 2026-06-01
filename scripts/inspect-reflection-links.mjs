// Diagnostic: for each reflection-derived observation, show its reflection,
// that reflection's signalIds, and whether the observation is actually linked
// to a signal via signal_observations.
//   node --env-file=.env.local scripts/inspect-reflection-links.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT o.id AS obs_id,
         left(o.content_text, 50) AS text_preview,
         o.reflection_id,
         r.signal_ids,
         o.ai_processed_at,
         (SELECT count(*) FROM signal_observations so WHERE so.observation_id = o.id) AS signal_link_count
  FROM observations o
  LEFT JOIN reflections r ON r.id = o.reflection_id
  WHERE o.reflection_id IS NOT NULL
  ORDER BY o.created_at DESC
`;

console.log(JSON.stringify(rows, null, 2));
process.exit(0);
