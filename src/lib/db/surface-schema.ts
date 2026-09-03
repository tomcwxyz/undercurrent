import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { observations, signals, spaces, users } from "./schema";

export const surfaceFeedback = pgTable(
  "surface_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    surface: text("surface").notNull().default("r1"),
    kind: text("kind")
      .$type<"ask_answer" | "signal_interpretation">()
      .notNull(),
    judgement: text("judgement")
      .$type<
        | "useful"
        | "not_useful"
        | "fits"
        | "does_not_fit"
        | "important"
        | "weak"
        | "split"
        | "changed_mind"
        | "stop_showing"
      >()
      .notNull(),
    question: text("question"),
    answer: text("answer"),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().default([]).notNull(),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [
    index("surface_feedback_space_created_idx").on(
      table.spaceId,
      table.createdAt,
    ),
    index("surface_feedback_signal_created_idx").on(
      table.signalId,
      table.createdAt,
    ),
    index("surface_feedback_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);


export const surfaceCaptureReviews = pgTable(
  "surface_capture_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
    surface: text("surface").notNull().default("r1"),
    status: text("status")
      .$type<"pending" | "reviewed">()
      .notNull()
      .default("pending"),
    decision: text("decision").$type<"keep_connection" | "keep_separate">(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (table) => [
    uniqueIndex("surface_capture_review_observation_surface_idx").on(
      table.observationId,
      table.surface,
    ),
    index("surface_capture_review_user_status_idx").on(
      table.userId,
      table.spaceId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const surfaceInteractionEvents = pgTable(
  "surface_interaction_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    observationId: uuid("observation_id").references(() => observations.id, {
      onDelete: "set null",
    }),
    surface: text("surface").notNull().default("r1"),
    sessionId: text("session_id").notNull(),
    event: text("event").notNull(),
    lens: text("lens"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
  },
  (table) => [
    index("surface_interaction_space_created_idx").on(
      table.spaceId,
      table.createdAt,
    ),
    index("surface_interaction_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("surface_interaction_session_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  ],
);
