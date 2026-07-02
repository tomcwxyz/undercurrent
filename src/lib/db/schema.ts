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
  varchar,
  type AnyPgColumn,
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

export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  token: text("token").notNull().unique(),
  isOpen: boolean("is_open").default(true).notNull(),
  closeAt: timestamp("close_at", { mode: "date" }),
  maxResponses: integer("max_responses"),
  responseCount: integer("response_count").default(0).notNull(),
  moderationEnabled: boolean("moderation_enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

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
  collectionId: uuid("collection_id").references(() => collections.id, {
    onDelete: "set null",
  }),
  // Set when this observation originated as a reflection response. Lets the
  // response re-enter the pipeline while staying traceable to its prompt.
  reflectionId: uuid("reflection_id").references((): AnyPgColumn => reflections.id, {
    onDelete: "set null",
  }),
  moderationStatus: text("moderation_status")
    .$type<"approved" | "pending" | "rejected">()
    .default("approved")
    .notNull(),
  hasImage: boolean("has_image").default(false),
  imageLabel: text("image_label"),
  aiEmbedding: vector("ai_embedding", { dimensions: 1536 }),
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

export const observationMedia = pgTable("observation_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  observationId: uuid("observation_id")
    .notNull()
    .references(() => observations.id, { onDelete: "cascade" }),
  type: text("type").$type<"image" | "voice" | "file">().notNull(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  fileName: text("file_name"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  aiTranscript: text("ai_transcript"),
  aiDescription: text("ai_description"),
  aiExtractedText: text("ai_extracted_text"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
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
  signalId: uuid("signal_id").references(() => signals.id, { onDelete: "cascade" }),
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

export const reflectionResponses = pgTable("reflection_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  reflectionId: uuid("reflection_id")
    .notNull()
    .references(() => reflections.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const spaceInvitations = pgTable("space_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role")
    .$type<"admin" | "facilitator" | "observer" | "viewer">()
    .notNull()
    .default("observer"),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  acceptedAt: timestamp("accepted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Billing tables ──

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  tier: text("tier")
    .$type<"individual" | "team" | "organisation">()
    .notNull(),
  status: text("status")
    .$type<"trialing" | "active" | "past_due" | "canceled" | "unpaid">()
    .notNull()
    .default("trialing"),
  trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  userLimit: integer("user_limit").notNull().default(1),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referralDiscountPct: integer("referral_discount_pct").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerSubscriptionId: uuid("referrer_subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  referredUserId: uuid("referred_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredSubscriptionId: uuid("referred_subscription_id").references(
    () => subscriptions.id,
    { onDelete: "set null" }
  ),
  rewardApplied: boolean("reward_applied").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // "2026-02"
  observationCount: integer("observation_count").notNull().default(0),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  type: text("type")
    .$type<"new_reflection" | "signal_transition" | "new_observation">()
    .notNull(),
  title: text("title").notNull(),
  body: text("body"),
  linkTo: text("link_to"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Backs checkRateLimit() — a fixed-window counter per key. Postgres rather
// than in-memory because serverless invocations don't share process memory.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { mode: "date" }).notNull(),
});
