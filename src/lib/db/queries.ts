import { eq, desc, gt, sql, and, isNotNull, inArray } from "drizzle-orm";
import { db } from ".";
import {
  observations,
  signals,
  constellationNodes,
  spaceMemberships,
  spaces,
  reflections,
  reflectionResponses,
  notifications,
  signalSnapshots,
  spaceInvitations,
  users,
  subscriptions,
  usageRecords,
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

export async function getObservationsForSpace(spaceId: string) {
  return db
    .select()
    .from(observations)
    .where(eq(observations.spaceId, spaceId))
    .orderBy(desc(observations.createdAt));
}

export async function getSignalsForSpace(spaceId: string) {
  return db
    .select()
    .from(signals)
    .where(eq(signals.spaceId, spaceId))
    .orderBy(desc(signals.lastUpdated));
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

  // Get all responses for these reflections
  const reflectionIds = reflectionRows.map((r) => r.id);
  const responseRows = await db
    .select()
    .from(reflectionResponses)
    .where(inArray(reflectionResponses.reflectionId, reflectionIds))
    .orderBy(desc(reflectionResponses.createdAt));

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
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  tier: "individual" | "team" | "organisation";
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  userLimit: number;
}) {
  const [row] = await db
    .insert(subscriptions)
    .values({
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      tier: data.tier,
      status: data.status,
      trialEndsAt: data.trialEndsAt,
      currentPeriodEnd: data.currentPeriodEnd,
      userLimit: data.userLimit,
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
