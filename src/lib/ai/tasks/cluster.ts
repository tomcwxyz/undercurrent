import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  observations,
  signalObservations,
} from "@/lib/db/schema";
import { AI_CONFIG } from "../config";

interface SimilarObservation {
  id: string;
  signal_id: string | null;
  distance: number;
}

/**
 * Find the best matching signal for a newly embedded observation.
 * Returns the signalId if clustered, or null if unattached.
 */
export async function clusterObservation(
  observationId: string,
  spaceId: string
): Promise<string | null> {
  // Find similar non-demo observations using pgvector cosine distance
  const similar = (await db.execute(sql`
    SELECT o.id, so.signal_id, (o.ai_embedding <=> (
      SELECT ai_embedding FROM observations WHERE id = ${observationId}
    )) AS distance
    FROM observations o
    LEFT JOIN signal_observations so ON so.observation_id = o.id
    WHERE o.space_id = ${spaceId}
      AND o.id != ${observationId}
      AND o.is_demo = false
      AND o.ai_embedding IS NOT NULL
      AND (o.ai_embedding <=> (
        SELECT ai_embedding FROM observations WHERE id = ${observationId}
      )) < ${AI_CONFIG.clustering.distanceThreshold}
    ORDER BY distance ASC
    LIMIT 20
  `)) as unknown as SimilarObservation[];

  if (similar.length === 0) return null;

  // Check if any similar observations belong to an existing signal
  const withSignal = similar.find((s) => s.signal_id !== null);

  if (withSignal) {
    // Attach this observation to the existing signal
    await db.insert(signalObservations).values({
      signalId: withSignal.signal_id!,
      observationId,
    });

    // Update signal counts
    await updateSignalCounts(withSignal.signal_id!);
    return withSignal.signal_id!;
  }

  // No existing signal — leave unattached for now (synthesise will pick it up)
  return null;
}

/** Recalculate observation_count and contributor_count for a signal */
async function updateSignalCounts(signalId: string): Promise<void> {
  await db.execute(sql`
    UPDATE signals SET
      observation_count = (
        SELECT COUNT(*) FROM signal_observations WHERE signal_id = ${signalId}
      ),
      contributor_count = (
        SELECT COUNT(DISTINCT o.author_id)
        FROM signal_observations so
        JOIN observations o ON o.id = so.observation_id
        WHERE so.signal_id = ${signalId}
      ),
      last_updated = NOW()
    WHERE id = ${signalId}
  `);
}

interface ClusterGroup {
  observationIds: string[];
}

/**
 * Find clusters of unattached observations that could form new signals.
 * Uses greedy clustering: pick an unattached obs, find its neighbours, form a group.
 */
export async function findUnattachedClusters(
  spaceId: string
): Promise<ClusterGroup[]> {
  // Get all unattached (non-demo, embedded) observations
  const unattached = await db
    .select({ id: observations.id })
    .from(observations)
    .leftJoin(
      signalObservations,
      eq(signalObservations.observationId, observations.id)
    )
    .where(
      and(
        eq(observations.spaceId, spaceId),
        eq(observations.isDemo, false),
        isNull(signalObservations.signalId),
        sql`${observations.aiEmbedding} IS NOT NULL`
      )
    );

  if (unattached.length < AI_CONFIG.clustering.minObservationsForSignal) {
    return [];
  }

  const assigned = new Set<string>();
  const clusters: ClusterGroup[] = [];

  for (const obs of unattached) {
    if (assigned.has(obs.id)) continue;

    // Find neighbours of this observation among unattached ones
    const neighbours = (await db.execute(sql`
      SELECT o.id, (o.ai_embedding <=> (
        SELECT ai_embedding FROM observations WHERE id = ${obs.id}
      )) AS distance
      FROM observations o
      LEFT JOIN signal_observations so ON so.observation_id = o.id
      WHERE o.space_id = ${spaceId}
        AND o.id != ${obs.id}
        AND o.is_demo = false
        AND o.ai_embedding IS NOT NULL
        AND so.signal_id IS NULL
        AND (o.ai_embedding <=> (
          SELECT ai_embedding FROM observations WHERE id = ${obs.id}
        )) < ${AI_CONFIG.clustering.distanceThreshold}
      ORDER BY distance ASC
    `)) as unknown as { id: string; distance: number }[];

    const clusterIds = [obs.id, ...neighbours.map((n) => n.id)].filter(
      (id) => !assigned.has(id)
    );

    if (clusterIds.length >= AI_CONFIG.clustering.minObservationsForSignal) {
      clusters.push({ observationIds: clusterIds });
      clusterIds.forEach((id) => assigned.add(id));
    }
  }

  return clusters;
}
