CREATE TABLE IF NOT EXISTS "surface_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "signal_id" uuid REFERENCES "signals"("id") ON DELETE SET NULL,
  "surface" text DEFAULT 'r1' NOT NULL,
  "kind" text NOT NULL,
  "judgement" text NOT NULL,
  "question" text,
  "answer" text,
  "evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "surface_feedback_space_created_idx"
  ON "surface_feedback" ("space_id", "created_at");

CREATE INDEX IF NOT EXISTS "surface_feedback_signal_created_idx"
  ON "surface_feedback" ("signal_id", "created_at");

CREATE INDEX IF NOT EXISTS "surface_feedback_user_created_idx"
  ON "surface_feedback" ("user_id", "created_at");
