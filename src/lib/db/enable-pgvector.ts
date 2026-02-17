import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const command = process.argv[2] || "all";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);

  if (command === "extension" || command === "all") {
    console.log("Enabling pgvector extension...");
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("pgvector extension enabled.");
  }

  if (command === "index" || command === "all") {
    console.log("Creating HNSW index on ai_embedding...");
    await sql`
      CREATE INDEX IF NOT EXISTS observations_embedding_idx
      ON observations
      USING hnsw (ai_embedding vector_cosine_ops)
    `;
    console.log("HNSW index created.");
  }

  console.log("Done.");
}

run().catch(console.error);
