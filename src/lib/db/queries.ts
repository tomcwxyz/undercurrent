import { eq, desc, gt, sql, and, isNotNull } from "drizzle-orm";
import { db } from ".";
import {
  observations,
  signals,
  constellationNodes,
  spaceMemberships,
  spaces,
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
