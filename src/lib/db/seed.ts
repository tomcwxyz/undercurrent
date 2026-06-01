import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from ".";
import {
  spaces,
  spaceMemberships,
  observations,
  observationMedia,
  signals,
  signalObservations,
  signalSnapshots,
  constellationNodes,
  collections,
  reflections,
} from "./schema";
import {
  SEED_IMAGES,
  SEED_SIGNALS,
  SEED_OBSERVATIONS,
  SEED_NODES,
  SEED_COLLECTIONS,
  SEED_REFLECTIONS,
  SEED_SNAPSHOTS,
  type SeedSentiment,
} from "./seed-data";

/** A date `daysAgo` days back, at the given hour. */
function dateFrom(daysAgo: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, Math.floor((daysAgo * 7) % 60), 0, 0);
  return d;
}

const imageByKey = new Map(SEED_IMAGES.map((img) => [img.key, img]));

/** Shape collected for each observation we're about to insert. */
interface ObsPlan {
  values: typeof observations.$inferInsert;
  author: string;
  createdAt: Date;
  signalKeys: string[]; // signals to link (empty if none / unprocessed)
  image?: string;
  linkToSignals: boolean; // false for pending (unmoderated) submissions
}

/**
 * Onboarding: create the demo space + owner membership, then fill it with the
 * rich demo dataset.
 */
export async function seedDemoData(userId: string): Promise<string> {
  const [space] = await db
    .insert(spaces)
    .values({
      name: "Community Sensing Project",
      description:
        "A shared space for observing what's shifting in your community and organisation.",
      type: "sensing",
      environment: "stars",
    })
    .returning({ id: spaces.id });

  await db.insert(spaceMemberships).values({ userId, spaceId: space.id, role: "owner" });

  await seedSpaceContent(space.id, userId);
  return space.id;
}

/**
 * Fill an *existing* space with the rich demo dataset — observations (with
 * media + sentiment + themes), signals, collections, reflections, constellation
 * nodes and snapshots. Every row is flagged `isDemo`, so the space shows the
 * demo banner and the content can be cleared later.
 *
 * Used by onboarding (above) and by "create a space with sample data".
 */
export async function seedSpaceContent(spaceId: string, userId: string): Promise<void> {
  // 2. Signals (counts/firstSeen filled in once observations are linked)
  const sigRows = await db
    .insert(signals)
    .values(
      SEED_SIGNALS.map((s) => ({
        spaceId,
        title: s.title,
        description: s.description,
        strength: s.strength,
        direction: s.direction,
        observationCount: 0,
        contributorCount: 0,
        firstSeen: dateFrom(45),
        lastUpdated: new Date(),
        aiGenerated: true,
        isDemo: true,
      }))
    )
    .returning({ id: signals.id });
  const sigId = new Map(SEED_SIGNALS.map((s, i) => [s.key, sigRows[i].id]));

  // 3. Collections (responseCount = approved submissions)
  const colRows = await db
    .insert(collections)
    .values(
      SEED_COLLECTIONS.map((c) => ({
        spaceId,
        title: c.title,
        description: c.description,
        token: randomBytes(9).toString("base64url"),
        isOpen: c.isOpen,
        closeAt: c.closeAtDaysFromNow != null ? dateFrom(-c.closeAtDaysFromNow) : null,
        maxResponses: c.maxResponses ?? null,
        responseCount: c.submissions.filter((s) => s.moderationStatus !== "pending").length,
        moderationEnabled: c.moderationEnabled,
        createdAt: dateFrom(c.createdDaysAgo),
      }))
    )
    .returning({ id: collections.id });
  const colId = new Map(SEED_COLLECTIONS.map((c, i) => [c.key, colRows[i].id]));

  // 4. Reflections (signalIds resolved to UUIDs)
  const reflRows = await db
    .insert(reflections)
    .values(
      SEED_REFLECTIONS.map((r) => ({
        spaceId,
        type: "prompted" as const,
        prompt: r.prompt,
        signalIds: r.signals.map((k) => sigId.get(k)!).filter(Boolean),
        learningLoop: r.learningLoop,
        triggerType: r.triggerType,
        createdAt: dateFrom(r.createdDaysAgo),
        isDemo: true,
      }))
    )
    .returning({ id: reflections.id });
  const reflId = new Map(SEED_REFLECTIONS.map((r, i) => [r.key, reflRows[i].id]));

  // 5. Assemble every observation: core + collection submissions + reflection responses
  const plans: ObsPlan[] = [];

  const processed = (sentiment: SeedSentiment, themes: string[], createdAt: Date) => ({
    aiSentimentData: sentiment,
    aiThemes: themes,
    aiProcessedAt: createdAt,
  });

  for (const o of SEED_OBSERVATIONS) {
    const createdAt = dateFrom(o.daysAgo, o.hour);
    const img = o.image ? imageByKey.get(o.image) : undefined;
    plans.push({
      values: {
        spaceId,
        authorName: o.author,
        contentText: o.text,
        signalStrength: o.signalStrength,
        hasImage: !!img,
        imageLabel: img?.label ?? null,
        createdAt,
        isDemo: true,
        ...processed(o.sentiment, o.themes, createdAt),
      },
      author: o.author,
      createdAt,
      signalKeys: o.signals,
      image: o.image,
      linkToSignals: true,
    });
  }

  for (const c of SEED_COLLECTIONS) {
    for (const s of c.submissions) {
      const createdAt = dateFrom(s.daysAgo, 12);
      const pending = s.moderationStatus === "pending";
      const img = s.image ? imageByKey.get(s.image) : undefined;
      plans.push({
        values: {
          spaceId,
          collectionId: colId.get(c.key)!,
          authorName: s.author ?? "Anonymous",
          contentText: s.text,
          signalStrength: "single",
          moderationStatus: pending ? "pending" : "approved",
          hasImage: !!img,
          imageLabel: img?.label ?? null,
          createdAt,
          isDemo: true,
          // Pending submissions are awaiting review → not yet processed.
          ...(pending ? {} : processed(s.sentiment, s.themes, createdAt)),
        },
        author: s.author ?? "Anonymous",
        createdAt,
        signalKeys: s.signals,
        image: s.image,
        linkToSignals: !pending,
      });
    }
  }

  for (const r of SEED_REFLECTIONS) {
    for (const resp of r.responses) {
      const createdAt = dateFrom(resp.daysAgo, 16);
      plans.push({
        values: {
          spaceId,
          reflectionId: reflId.get(r.key)!,
          authorId: userId,
          authorName: resp.author,
          contentText: resp.text,
          signalStrength: "single",
          createdAt,
          isDemo: true,
          ...processed(resp.sentiment, resp.themes, createdAt),
        },
        author: resp.author,
        createdAt,
        signalKeys: r.signals,
        linkToSignals: true,
      });
    }
  }

  // 6. Insert all observations in one go; ids come back in input order.
  const obsRows = await db
    .insert(observations)
    .values(plans.map((p) => p.values))
    .returning({ id: observations.id });
  plans.forEach((p, i) => ((p as ObsPlan & { id: string }).id = obsRows[i].id));
  const planId = (p: ObsPlan) => (p as ObsPlan & { id: string }).id;

  // 7. Media rows for observations with an image
  const mediaRows = plans
    .filter((p) => p.image)
    .map((p) => {
      const img = imageByKey.get(p.image!)!;
      return {
        observationId: planId(p),
        type: "image" as const,
        storageKey: `demo/${img.key}.svg`,
        url: `/demo/${img.key}.svg`,
        fileName: `${img.key}.svg`,
        mimeType: "image/svg+xml",
        fileSize: 2048,
        aiDescription: img.description,
        createdAt: p.createdAt,
      };
    });
  if (mediaRows.length > 0) await db.insert(observationMedia).values(mediaRows);

  // 8. Signal ↔ observation links, plus per-signal counts and first-seen.
  const junctions: { signalId: string; observationId: string }[] = [];
  const stats = new Map<string, { obs: Set<string>; authors: Set<string>; first: Date }>();
  for (const p of plans) {
    if (!p.linkToSignals) continue;
    for (const key of p.signalKeys) {
      const id = sigId.get(key);
      if (!id) continue;
      junctions.push({ signalId: id, observationId: planId(p) });
      const stat = stats.get(key) ?? { obs: new Set(), authors: new Set(), first: p.createdAt };
      stat.obs.add(planId(p));
      stat.authors.add(p.author);
      if (p.createdAt < stat.first) stat.first = p.createdAt;
      stats.set(key, stat);
    }
  }
  if (junctions.length > 0) {
    await db.insert(signalObservations).values(junctions).onConflictDoNothing();
  }

  for (const [key, stat] of stats) {
    await db
      .update(signals)
      .set({
        observationCount: stat.obs.size,
        contributorCount: stat.authors.size,
        firstSeen: stat.first,
      })
      .where(eq(signals.id, sigId.get(key)!));
  }

  // 9. Constellation nodes, then wire up connections by key.
  const nodeRows = await db
    .insert(constellationNodes)
    .values(
      SEED_NODES.map((n) => ({
        spaceId,
        signalId: n.signal ? sigId.get(n.signal) ?? null : null,
        label: n.label,
        x: n.x,
        y: n.y,
        size: n.size,
        type: n.type,
        connections: [],
        description: n.text,
        isDemo: true,
      }))
    )
    .returning({ id: constellationNodes.id });
  const nodeId = new Map(SEED_NODES.map((n, i) => [n.key, nodeRows[i].id]));

  for (const n of SEED_NODES) {
    const conns = n.connections.map((k) => nodeId.get(k)).filter(Boolean) as string[];
    if (conns.length === 0) continue;
    await db
      .update(constellationNodes)
      .set({ connections: conns })
      .where(eq(constellationNodes.id, nodeId.get(n.key)!));
  }

  // 10. Signal snapshots for the Timeline / trend.
  const snapshotRows = SEED_SNAPSHOTS.map((s) => ({
    signalId: sigId.get(s.signal)!,
    snapshotAt: dateFrom(s.daysAgo),
    strength: s.strength,
    direction: s.direction,
    observationCount: s.observationCount,
    contributorCount: s.contributorCount,
  })).filter((s) => s.signalId);
  if (snapshotRows.length > 0) await db.insert(signalSnapshots).values(snapshotRows);
}
