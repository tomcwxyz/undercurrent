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
