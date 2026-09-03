CREATE TABLE IF NOT EXISTS "surface_capture_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "reviewed_at" timestamp,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "observation_id" uuid NOT NULL REFERENCES "observations"("id") ON DELETE CASCADE,
  "surface" text DEFAULT 'r1' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "decision" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "surface_capture_review_observation_surface_idx"
  ON "surface_capture_reviews" ("observation_id", "surface");

CREATE INDEX IF NOT EXISTS "surface_capture_review_user_status_idx"
  ON "surface_capture_reviews" ("user_id", "space_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "surface_interaction_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "space_id" uuid NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "signal_id" uuid REFERENCES "signals"("id") ON DELETE SET NULL,
  "observation_id" uuid REFERENCES "observations"("id") ON DELETE SET NULL,
  "surface" text DEFAULT 'r1' NOT NULL,
  "session_id" text NOT NULL,
  "event" text NOT NULL,
  "lens" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "surface_interaction_space_created_idx"
  ON "surface_interaction_events" ("space_id", "created_at");

CREATE INDEX IF NOT EXISTS "surface_interaction_user_created_idx"
  ON "surface_interaction_events" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "surface_interaction_session_idx"
  ON "surface_interaction_events" ("session_id", "created_at");
