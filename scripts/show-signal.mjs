// Show a signal's current state.  node --env-file=.env.local scripts/show-signal.mjs <signalId>
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2] ?? "cef20b38-be53-44bb-86ec-0b2de427b879";
const [s] = await sql`SELECT id, title, strength, direction, observation_count, contributor_count, left(description, 160) AS description, last_updated FROM signals WHERE id = ${id}`;
console.log(JSON.stringify(s, null, 2));
process.exit(0);
