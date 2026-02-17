import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function enablePgvector() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Enabling pgvector extension...");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension enabled.");

  console.log("Creating HNSW index on ai_embedding...");
  await sql`
    CREATE INDEX IF NOT EXISTS observations_embedding_idx
    ON observations
    USING hnsw (ai_embedding vector_cosine_ops)
  `;
  console.log("HNSW index created.");

  console.log("Done.");
}

enablePgvector().catch(console.error);
