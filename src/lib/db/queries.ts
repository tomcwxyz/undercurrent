import { eq, desc, gt, sql, and, isNotNull, inArray, ne } from "drizzle-orm";
import { db } from ".";
import {
  observations,
  observationMedia,
  signals,
  signalObservations,
  constellationNodes,
  spaceMemberships,
  spaces,
  reflections,
  notifications,
  signalSnapshots,
  spaceInvitations,
  users,
  subscriptions,
  usageRecords,
  referrals,
  collections,
} from "./schema";
import type { SpaceStats } from "@/lib/types";

export async function getUserDefaultSpace(
  userId: string
): Promise<string | null> {
  const rows = await db
    .select({ spaceId: spaceMemberships.spaceId })
    .from(spaceMemberships)
    .where(eq(spaceMemberships.userId, userId))
    .innerJoin(spaces, eq(spaces.id, spaceMemberships.spaceId))
    .limit(1);
  return rows[0]?.spaceId ?? null;
}

// Explicit column list, omitting the 1536-dim aiEmbedding vector — nothing on
// the read paths that use this (River/Timeline/Landscape) needs it.
export async function getObservationsForSpace(spaceId: string) {
  return db
    .select({
      id: observations.id,
      createdAt: observations.createdAt,
      authorId: observations.authorId,
      authorName: observations.authorName,
      spaceId: observations.spaceId,
      contentText: observations.contentText,
      contentImages: observations.contentImages,
      aiSentiment: observations.aiSentiment,
      aiThemes: observations.aiThemes,
      signalStrength: observations.signalStrength,
      isAnonymous: observations.isAnonymous,
      isDemo: observations.isDemo,
      collectionId: observations.collectionId,
      reflectionId: observations.reflectionId,
      moderationStatus: observations.moderationStatus,
      hasImage: observations.hasImage,
      imageLabel: observations.imageLabel,
      aiSentimentData: observations.aiSentimentData,
      aiEntities: observations.aiEntities,
      aiProcessedAt: observations.aiProcessedAt,
    })
    .from(observations)
    .where(eq(observations.spaceId, spaceId))
    .orderBy(desc(observations.createdAt));
}

export async function getMediaForObservations(observationIds: string[]) {
  if (observationIds.length === 0) return [];
  try {
    return await db
      .select()
      .from(observationMedia)
      .where(inArray(observationMedia.observationId, observationIds));
  } catch {
    // observation_media table may not exist yet (needs drizzle-kit push)
    return [];
  }
}

export async function getMediaForObservation(observationId: string) {
  return db
    .select()
    .from(observationMedia)
    .where(eq(observationMedia.observationId, observationId));
}

export async function getSignalsForSpace(spaceId: string) {
  return db
    .select()
    .from(signals)
    .where(eq(signals.spaceId, spaceId))
    .orderBy(desc(signals.lastUpdated));
}

export async function getSignalObservationsForSpace(spaceId: string) {
  return db
    .select({
      signalId: signalObservations.signalId,
      observationId: signalObservations.observationId,
    })
    .from(signalObservations)
    .innerJoin(signals, eq(signals.id, signalObservations.signalId))
    .where(eq(signals.spaceId, spaceId));
}

export async function getConstellationNodesForSpace(spaceId: string) {
  return db
    .select()
    .from(constellationNodes)
    .where(eq(constellationNodes.spaceId, spaceId));
}

export async function getSpaceStats(spaceId: string): Promise<SpaceStats> {
  const [obsResult, sigResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(observations)
      .where(eq(observations.spaceId, spaceId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(signals)
      .where(eq(signals.spaceId, spaceId)),
  ]);

  return {
    observationCount: obsResult[0]?.count ?? 0,
    signalCount: sigResult[0]?.count ?? 0,
  };
}

export async function hasDemoData(spaceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: observations.id })
    .from(observations)
    .where(
      and(eq(observations.spaceId, spaceId), eq(observations.isDemo, true))
    )
    .limit(1);
  return rows.length > 0;
}

export async function getObservationsWithSentiment(spaceId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 56);
  return db
    .select({
      id: observations.id,
      contentText: observations.contentText,
      authorName: observations.authorName,
      createdAt: observations.createdAt,
      aiSentimentData: observations.aiSentimentData,
      aiThemes: observations.aiThemes,
    })
    .from(observations)
    .where(
      and(
        eq(observations.spaceId, spaceId),
        gt(observations.createdAt, cutoff),
        isNotNull(observations.aiProcessedAt)
      )
    )
    .orderBy(desc(observations.createdAt));
}

// ── Signal snapshot queries ──

export async function getSignalSnapshotsForSpace(spaceId: string) {
  return db
    .select({
      id: signalSnapshots.id,
      signalId: signalSnapshots.signalId,
      snapshotAt: signalSnapshots.snapshotAt,
      strength: signalSnapshots.strength,
      direction: signalSnapshots.direction,
    })
    .from(signalSnapshots)
    .innerJoin(signals, eq(signals.id, signalSnapshots.signalId))
    .where(eq(signals.spaceId, spaceId))
    .orderBy(desc(signalSnapshots.snapshotAt));
}

// ── Reflection queries ──

export async function getReflectionsForSpace(spaceId: string) {
  const reflectionRows = await db
    .select()
    .from(reflections)
    .where(eq(reflections.spaceId, spaceId))
    .orderBy(desc(reflections.createdAt));

  if (reflectionRows.length === 0) return { reflections: [], responses: [], signalTitleMap: {} };

  // Responses are stored as observations linked via reflectionId (so they can
  // re-enter the AI pipeline). Pull those, excluding any rejected by moderation.
  const reflectionIds = reflectionRows.map((r) => r.id);
  const responseRows = await db
    .select()
    .from(observations)
    .where(
      and(
        inArray(observations.reflectionId, reflectionIds),
        ne(observations.moderationStatus, "rejected")
      )
    )
    .orderBy(desc(observations.createdAt));

  // Collect all signal IDs referenced by reflections
  const allSignalIds = [...new Set(reflectionRows.flatMap((r) => (r.signalIds as string[]) ?? []))];
  const signalTitleMap: Record<string, string> = {};

  if (allSignalIds.length > 0) {
    const signalRows = await db
      .select({ id: signals.id, title: signals.title })
      .from(signals)
      .where(inArray(signals.id, allSignalIds));
    for (const s of signalRows) {
      signalTitleMap[s.id] = s.title;
    }
  }

  return { reflections: reflectionRows, responses: responseRows, signalTitleMap };
}

export async function getReflectionById(reflectionId: string) {
  const [row] = await db
    .select()
    .from(reflections)
    .where(eq(reflections.id, reflectionId))
    .limit(1);
  return row ?? null;
}

// ── Notification queries ──

export async function getNotificationsForUser(userId: string, spaceId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.spaceId, spaceId)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadNotificationCount(userId: string, spaceId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.spaceId, spaceId),
        eq(notifications.read, false)
      )
    );
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string, spaceId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.spaceId, spaceId),
        eq(notifications.read, false)
      )
    );
}

export async function notifySpaceMembers(
  spaceId: string,
  type: "new_reflection" | "signal_transition" | "new_observation",
  title: string,
  body: string,
  linkTo: string,
  excludeUserId?: string
) {
  const members = await db
    .select({ userId: spaceMemberships.userId })
    .from(spaceMemberships)
    .where(eq(spaceMemberships.spaceId, spaceId));

  const userIds = members
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);

  if (userIds.length === 0) return;

  await db.insert(notifications).values(
    userIds.map((userId) => ({
      userId,
      spaceId,
      type,
      title,
      body,
      linkTo,
    }))
  );
}

// ── Space management queries ──

export async function getSpacesForUser(userId: string) {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      role: spaceMemberships.role,
    })
    .from(spaceMemberships)
    .innerJoin(spaces, eq(spaces.id, spaceMemberships.spaceId))
    .where(eq(spaceMemberships.userId, userId));
}

export async function getSpaceMembers(spaceId: string) {
  return db
    .select({
      userId: spaceMemberships.userId,
      role: spaceMemberships.role,
      name: users.name,
      email: users.email,
    })
    .from(spaceMemberships)
    .innerJoin(users, eq(users.id, spaceMemberships.userId))
    .where(eq(spaceMemberships.spaceId, spaceId));
}

export async function createSpace(name: string, description: string | null, userId: string): Promise<string> {
  const [space] = await db
    .insert(spaces)
    .values({ name, description })
    .returning({ id: spaces.id });

  await db.insert(spaceMemberships).values({
    userId,
    spaceId: space.id,
    role: "owner",
  });

  return space.id;
}

export async function getSpaceById(spaceId: string) {
  const rows = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSpace(spaceId: string, fields: { name?: string; description?: string | null; environment?: string }) {
  await db
    .update(spaces)
    .set(fields)
    .where(eq(spaces.id, spaceId));
}

export async function deleteSpace(spaceId: string) {
  await db.delete(spaces).where(eq(spaces.id, spaceId));
}

export async function getMemberRole(userId: string, spaceId: string): Promise<string | null> {
  const rows = await db
    .select({ role: spaceMemberships.role })
    .from(spaceMemberships)
    .where(and(eq(spaceMemberships.userId, userId), eq(spaceMemberships.spaceId, spaceId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function updateMemberRole(userId: string, spaceId: string, role: string) {
  await db
    .update(spaceMemberships)
    .set({ role })
    .where(and(eq(spaceMemberships.userId, userId), eq(spaceMemberships.spaceId, spaceId)));
}

export async function removeMember(userId: string, spaceId: string) {
  await db
    .delete(spaceMemberships)
    .where(and(eq(spaceMemberships.userId, userId), eq(spaceMemberships.spaceId, spaceId)));
}

export async function createInvitation(
  spaceId: string,
  email: string,
  role: string,
  invitedBy: string,
  token: string,
  expiresAt: Date,
) {
  const [row] = await db
    .insert(spaceInvitations)
    .values({ spaceId, email, role: role as "admin" | "facilitator" | "observer" | "viewer", invitedBy, token, expiresAt })
    .returning({ id: spaceInvitations.id });
  return row;
}

export async function getInvitationByToken(token: string) {
  const rows = await db
    .select()
    .from(spaceInvitations)
    .where(eq(spaceInvitations.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInvitationsForSpace(spaceId: string) {
  return db
    .select({
      id: spaceInvitations.id,
      email: spaceInvitations.email,
      role: spaceInvitations.role,
      invitedByName: users.name,
      createdAt: spaceInvitations.createdAt,
      expiresAt: spaceInvitations.expiresAt,
      acceptedAt: spaceInvitations.acceptedAt,
    })
    .from(spaceInvitations)
    .innerJoin(users, eq(users.id, spaceInvitations.invitedBy))
    .where(eq(spaceInvitations.spaceId, spaceId))
    .orderBy(desc(spaceInvitations.createdAt));
}

export async function acceptInvitation(token: string, userId: string): Promise<string | null> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (invitation.expiresAt < new Date()) return null;

  // Mark as accepted
  await db
    .update(spaceInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(spaceInvitations.id, invitation.id));

  // Check if already a member
  const existing = await getMemberRole(userId, invitation.spaceId);
  if (!existing) {
    await db.insert(spaceMemberships).values({
      userId,
      spaceId: invitation.spaceId,
      role: invitation.role,
    });
  }

  return invitation.spaceId;
}

export async function getSpaceMemberCount(spaceId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spaceMemberships)
    .where(eq(spaceMemberships.spaceId, spaceId));
  return result[0]?.count ?? 0;
}

/** Bulk member counts, one query for all spaces instead of N. */
export async function getSpaceMemberCounts(
  spaceIds: string[]
): Promise<Map<string, number>> {
  if (spaceIds.length === 0) return new Map();
  const rows = await db
    .select({ spaceId: spaceMemberships.spaceId, count: sql<number>`count(*)::int` })
    .from(spaceMemberships)
    .where(inArray(spaceMemberships.spaceId, spaceIds))
    .groupBy(spaceMemberships.spaceId);
  return new Map(rows.map((r) => [r.spaceId, r.count]));
}

// ── Subscription queries ──

export async function getSubscriptionForUser(userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSubscription(data: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  tier: "individual" | "team" | "organisation";
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  userLimit: number;
  referralCode?: string;
}) {
  const [row] = await db
    .insert(subscriptions)
    .values({
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      tier: data.tier,
      status: data.status,
      trialEndsAt: data.trialEndsAt,
      currentPeriodEnd: data.currentPeriodEnd,
      userLimit: data.userLimit,
      referralCode: data.referralCode,
    })
    .returning({ id: subscriptions.id });
  return row;
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  fields: {
    status?: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
    currentPeriodEnd?: Date;
    tier?: "individual" | "team" | "organisation";
    userLimit?: number;
  }
) {
  await db
    .update(subscriptions)
    .set(fields)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function getObservationCountThisMonth(spaceId: string): Promise<number> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const result = await db
    .select({ count: usageRecords.observationCount })
    .from(usageRecords)
    .where(and(eq(usageRecords.spaceId, spaceId), eq(usageRecords.month, month)))
    .limit(1);
  return result[0]?.count ?? 0;
}

/**
 * Total observations counted against a subscription this month, summed across
 * all of the account's spaces. The monthly observation limit is per-account,
 * so this is what the limit is checked against.
 */
/**
 * Space IDs with at least `minObservations` real (non-demo) observations since
 * `cutoff`. Used by the attention cron to skip dormant spaces in one query
 * rather than spinning up an analysis per empty space.
 */
export async function getActiveSpaceIdsSince(cutoff: Date, minObservations: number): Promise<string[]> {
  const rows = await db
    .select({ spaceId: observations.spaceId })
    .from(observations)
    .where(and(eq(observations.isDemo, false), gt(observations.createdAt, cutoff)))
    .groupBy(observations.spaceId)
    .having(sql`count(*) >= ${minObservations}`);
  return rows.map((r) => r.spaceId);
}

export async function getObservationCountForSubscription(subscriptionId: string): Promise<number> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${usageRecords.observationCount}), 0)` })
    .from(usageRecords)
    .where(and(eq(usageRecords.subscriptionId, subscriptionId), eq(usageRecords.month, month)));
  return Number(row?.total ?? 0);
}

export async function incrementObservationCount(subscriptionId: string, spaceId: string) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Try to increment existing record
  const updated = await db
    .update(usageRecords)
    .set({ observationCount: sql`${usageRecords.observationCount} + 1` })
    .where(
      and(
        eq(usageRecords.subscriptionId, subscriptionId),
        eq(usageRecords.spaceId, spaceId),
        eq(usageRecords.month, month)
      )
    )
    .returning({ id: usageRecords.id });

  if (updated.length === 0) {
    await db.insert(usageRecords).values({
      subscriptionId,
      spaceId,
      month,
      observationCount: 1,
    });
  }
}

// ── Referral queries ──

export async function getSubscriptionByReferralCode(code: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.referralCode, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function createReferral(
  referrerSubscriptionId: string,
  referredUserId: string,
) {
  const [row] = await db
    .insert(referrals)
    .values({ referrerSubscriptionId, referredUserId })
    .returning({ id: referrals.id });
  return row;
}

export async function getPendingReferralForUser(userId: string) {
  const rows = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredUserId, userId), eq(referrals.rewardApplied, false)))
    .limit(1);
  return rows[0] ?? null;
}

export async function markReferralRewarded(
  referralId: string,
  referredSubscriptionId: string,
) {
  await db
    .update(referrals)
    .set({ rewardApplied: true, referredSubscriptionId })
    .where(eq(referrals.id, referralId));
}

export async function incrementReferralDiscount(subscriptionId: string) {
  await db
    .update(subscriptions)
    .set({
      referralDiscountPct: sql`LEAST(${subscriptions.referralDiscountPct} + 10, 30)`,
    })
    .where(eq(subscriptions.id, subscriptionId));
}

export async function getReferralCountForSubscription(subscriptionId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referrals)
    .where(and(eq(referrals.referrerSubscriptionId, subscriptionId), eq(referrals.rewardApplied, true)));
  return result[0]?.count ?? 0;
}

// ── Admin queries ──

export async function getAllSpacesWithDetails() {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      createdAt: spaces.createdAt,
      memberCount: sql<number>`(SELECT count(*)::int FROM space_memberships WHERE space_id = ${spaces.id})`,
      observationCount: sql<number>`(SELECT count(*)::int FROM observations WHERE space_id = ${spaces.id})`,
      lastActiveAt: sql<Date | null>`(SELECT max(created_at) FROM observations WHERE space_id = ${spaces.id})`,
      observationCount7d: sql<number>`(SELECT count(*)::int FROM observations WHERE space_id = ${spaces.id} AND created_at > now() - interval '7 days')`,
      observationCount30d: sql<number>`(SELECT count(*)::int FROM observations WHERE space_id = ${spaces.id} AND created_at > now() - interval '30 days')`,
    })
    .from(spaces)
    .orderBy(desc(spaces.createdAt));
}

export async function getAllUsersWithDetails() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      // Subscription fields (LEFT JOIN)
      tier: subscriptions.tier,
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      referralCode: subscriptions.referralCode,
      referralDiscountPct: subscriptions.referralDiscountPct,
      // Activity subqueries
      lastActiveAt: sql<Date | null>`(SELECT max(created_at) FROM observations WHERE author_id = ${users.id})`,
      observationCount7d: sql<number>`(SELECT count(*)::int FROM observations WHERE author_id = ${users.id} AND created_at > now() - interval '7 days')`,
      observationCount30d: sql<number>`(SELECT count(*)::int FROM observations WHERE author_id = ${users.id} AND created_at > now() - interval '30 days')`,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .orderBy(users.email);
}

export async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

export async function updateUser(userId: string, fields: { name?: string; email?: string }) {
  await db.update(users).set(fields).where(eq(users.id, userId));
}

export async function clearDemoData(spaceId: string): Promise<void> {
  await Promise.all([
    db
      .delete(observations)
      .where(
        and(eq(observations.spaceId, spaceId), eq(observations.isDemo, true))
      ),
    db
      .delete(signals)
      .where(and(eq(signals.spaceId, spaceId), eq(signals.isDemo, true))),
    db
      .delete(constellationNodes)
      .where(
        and(
          eq(constellationNodes.spaceId, spaceId),
          eq(constellationNodes.isDemo, true)
        )
      ),
  ]);
}

/**
 * Reset demo account: delete all spaces owned by this user so onboarding re-seeds.
 */
export async function resetDemoAccount(userId: string): Promise<void> {
  // Get all spaces the user is a member of
  const userSpaces = await db
    .select({ spaceId: spaceMemberships.spaceId })
    .from(spaceMemberships)
    .where(eq(spaceMemberships.userId, userId));

  // Delete all their spaces (cascades delete observations, signals, etc.)
  for (const { spaceId } of userSpaces) {
    await db.delete(spaces).where(eq(spaces.id, spaceId));
  }

  // Delete their subscription so onboarding can re-create
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
}

// ── Collection queries ──

export async function getCollectionsForSpace(spaceId: string) {
  return db
    .select()
    .from(collections)
    .where(eq(collections.spaceId, spaceId))
    .orderBy(desc(collections.createdAt));
}

export async function getCollectionByToken(token: string) {
  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.token, token))
    .limit(1);
  return row ?? null;
}

export async function createCollection(data: {
  spaceId: string;
  title: string;
  description?: string | null;
  token: string;
  closeAt?: Date | null;
  maxResponses?: number | null;
  moderationEnabled?: boolean;
}) {
  const [row] = await db.insert(collections).values(data).returning();
  return row;
}

export async function updateCollection(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    isOpen: boolean;
    closeAt: Date | null;
    maxResponses: number | null;
    moderationEnabled: boolean;
  }>
) {
  await db.update(collections).set(data).where(eq(collections.id, id));
}

export async function deleteCollection(id: string) {
  await db.delete(collections).where(eq(collections.id, id));
}

export async function incrementCollectionResponseCount(id: string) {
  await db
    .update(collections)
    .set({ responseCount: sql`${collections.responseCount} + 1` })
    .where(eq(collections.id, id));
}

export async function getObservationsForCollection(collectionId: string) {
  return db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.collectionId, collectionId),
        ne(observations.moderationStatus, "rejected")
      )
    )
    .orderBy(desc(observations.createdAt));
}
