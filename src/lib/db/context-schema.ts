import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { observations, spaces, users } from "./schema";
import type { ContextEvent } from "@/lib/context/types";
import type { SwellsSensingPrompt } from "@/lib/context/swells";

/**
 * Private, transient prompts created from connected external context.
 * They are not observations and therefore do not influence signals until the
 * user deliberately responds and keeps something as an Observation.
 */
export const contextPrompts = pgTable(
  "context_prompts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id").notNull(),
    sourceProvider: text("source_provider").notNull(),
    event: jsonb("event").$type<ContextEvent>().notNull(),
    interpretation: jsonb("interpretation").$type<SwellsSensingPrompt>().notNull(),
    status: text("status")
      .$type<"pending" | "dismissed" | "kept">()
      .notNull()
      .default("pending"),
    observationId: uuid("observation_id").references(() => observations.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("context_prompts_user_space_event_idx").on(
      table.userId,
      table.spaceId,
      table.externalEventId,
    ),
    index("context_prompts_user_space_status_idx").on(
      table.userId,
      table.spaceId,
      table.status,
    ),
  ],
);
