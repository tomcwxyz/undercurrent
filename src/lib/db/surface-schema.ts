import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { signals, spaces, users } from "./schema";

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
