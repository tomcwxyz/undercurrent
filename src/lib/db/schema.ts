import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  primaryKey,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ── Auth.js tables ──

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ── App tables ──

export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("sensing"),
  environment: text("environment").default("stars"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const spaceMemberships = pgTable(
  "space_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("observer"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.spaceId] })]
);

export const observations = pgTable("observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  authorId: uuid("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  authorName: text("author_name"),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  contentText: text("content_text").notNull(),
  contentImages: jsonb("content_images").$type<string[]>().default([]),
  aiSentiment: text("ai_sentiment"),
  aiThemes: jsonb("ai_themes").$type<string[]>().default([]),
  signalStrength: text("signal_strength")
    .$type<"strong" | "emerging" | "weak" | "single">()
    .default("single"),
  isAnonymous: boolean("is_anonymous").default(false),
  isDemo: boolean("is_demo").default(false),
  hasImage: boolean("has_image").default(false),
  imageLabel: text("image_label"),
  aiEmbedding: vector("ai_embedding", { dimensions: 3072 }),
  aiSentimentData: jsonb("ai_sentiment_data").$type<{
    energy: number;
    valence: number;
    arousal: number;
    label: string;
  }>(),
  aiEntities: jsonb("ai_entities").$type<
    { name: string; type: "person" | "place" | "organisation" | "concept" | "project" }[]
  >(),
  aiProcessedAt: timestamp("ai_processed_at", { mode: "date" }),
});

export const signals = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  strength: text("strength")
    .$type<"strong" | "emerging" | "weak">()
    .notNull(),
  direction: text("direction")
    .$type<"strengthening" | "steady" | "new">()
    .notNull(),
  observationCount: integer("observation_count").default(0),
  contributorCount: integer("contributor_count").default(0),
  firstSeen: timestamp("first_seen", { mode: "date" }).defaultNow().notNull(),
  lastUpdated: timestamp("last_updated", { mode: "date" })
    .defaultNow()
    .notNull(),
  status: text("status").default("active"),
  isDemo: boolean("is_demo").default(false),
  sentiment: jsonb("sentiment").$type<{
    avgEnergy: number;
    avgValence: number;
    dominantThemes: string[];
  }>(),
  aiGenerated: boolean("ai_generated").default(false),
  humanValidated: boolean("human_validated").default(false),
});

export const signalObservations = pgTable(
  "signal_observations",
  {
    signalId: uuid("signal_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.signalId, table.observationId] })]
);

export const constellationNodes = pgTable("constellation_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  size: real("size").notNull(),
  type: text("type")
    .$type<"strong" | "emerging" | "weak" | "single">()
    .notNull(),
  connections: jsonb("connections").$type<string[]>().default([]),
  description: text("description"),
  isDemo: boolean("is_demo").default(false),
});

// ── AI pipeline tables ──

export const signalSnapshots = pgTable("signal_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  signalId: uuid("signal_id")
    .notNull()
    .references(() => signals.id, { onDelete: "cascade" }),
  snapshotAt: timestamp("snapshot_at", { mode: "date" }).defaultNow().notNull(),
  strength: text("strength")
    .$type<"strong" | "emerging" | "weak">()
    .notNull(),
  direction: text("direction")
    .$type<"strengthening" | "steady" | "new">()
    .notNull(),
  observationCount: integer("observation_count").default(0),
  contributorCount: integer("contributor_count").default(0),
  sentimentAgg: jsonb("sentiment_agg").$type<{
    avgEnergy: number;
    avgValence: number;
  }>(),
});

export const signalConnections = pgTable(
  "signal_connections",
  {
    signalAId: uuid("signal_a_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    signalBId: uuid("signal_b_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    strength: real("strength").notNull(),
    type: text("type")
      .$type<"reinforcing" | "contrasting" | "adjacent">()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.signalAId, table.signalBId] })]
);

export const reflections = pgTable("reflections", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  type: text("type").$type<"prompted" | "scheduled">().notNull(),
  prompt: text("prompt").notNull(),
  signalIds: jsonb("signal_ids").$type<string[]>().default([]),
  synthesis: text("synthesis"),
  learningLoop: text("learning_loop")
    .$type<"single" | "double" | "triple">()
    .default("single"),
  triggerType: text("trigger_type"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  isDemo: boolean("is_demo").default(false),
});
