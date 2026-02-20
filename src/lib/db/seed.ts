import { db } from ".";
import {
  spaces,
  spaceMemberships,
  observations,
  signals,
  signalObservations,
  constellationNodes,
} from "./schema";
import {
  OBSERVATIONS,
  SIGNALS,
  CONSTELLATION_NODES,
} from "@/lib/mock-data";

/** Plausible AI sentiment data for demo observations, keyed by mock ID. */
const DEMO_SENTIMENT: Record<string, {
  aiSentimentData: { energy: number; valence: number; arousal: number; label: string };
  aiThemes: string[];
}> = {
  "1": {
    aiSentimentData: { energy: 0.4, valence: 0.5, arousal: 0.6, label: "Energised" },
    aiThemes: ["group dynamics", "momentum", "culture shift"],
  },
  "2": {
    aiSentimentData: { energy: 0.2, valence: -0.1, arousal: 0.3, label: "Warm" },
    aiThemes: ["community voice", "participation", "power dynamics"],
  },
  "3": {
    aiSentimentData: { energy: 0.7, valence: -0.3, arousal: 0.8, label: "Urgent" },
    aiThemes: ["budget", "strategy", "institutional challenge"],
  },
  "4": {
    aiSentimentData: { energy: -0.1, valence: 0.3, arousal: 0.1, label: "Calm" },
    aiThemes: ["communication", "partnership", "tone shift"],
  },
  "5": {
    aiSentimentData: { energy: 0.35, valence: 0.4, arousal: 0.5, label: "Energised" },
    aiThemes: ["community space", "engagement", "grassroots energy"],
  },
  "6": {
    aiSentimentData: { energy: -0.3, valence: -0.1, arousal: 0.2, label: "Reflective" },
    aiThemes: ["process", "innovation", "accidental discovery"],
  },
  "7": {
    aiSentimentData: { energy: 0.6, valence: -0.2, arousal: 0.7, label: "Urgent" },
    aiThemes: ["systemic patterns", "partnership", "frustration"],
  },
};

/** Parse relative time strings from mock data into real dates. */
function relativeDate(timeStr: string): Date {
  const now = new Date();
  if (timeStr.startsWith("Today")) {
    const match = timeStr.match(/(\d+):(\d+)(am|pm)/);
    if (match) {
      let h = parseInt(match[1]);
      if (match[3] === "pm" && h !== 12) h += 12;
      if (match[3] === "am" && h === 12) h = 0;
      now.setHours(h, parseInt(match[2]), 0, 0);
    }
    return now;
  }
  if (timeStr.startsWith("Yesterday")) {
    now.setDate(now.getDate() - 1);
    const match = timeStr.match(/(\d+):(\d+)(am|pm)/);
    if (match) {
      let h = parseInt(match[1]);
      if (match[3] === "pm" && h !== 12) h += 12;
      if (match[3] === "am" && h === 12) h = 0;
      now.setHours(h, parseInt(match[2]), 0, 0);
    }
    return now;
  }
  const daysMatch = timeStr.match(/(\d+) days? ago/);
  if (daysMatch) {
    now.setDate(now.getDate() - parseInt(daysMatch[1]));
    now.setHours(10, 0, 0, 0);
    return now;
  }
  return now;
}

export async function seedDemoData(userId: string): Promise<string> {
  // 1. Create space
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

  const spaceId = space.id;

  // 2. Create owner membership
  await db.insert(spaceMemberships).values({
    userId,
    spaceId,
    role: "owner",
  });

  // 3. Insert observations
  const obsIdMap = new Map<string, string>();
  for (const obs of OBSERVATIONS) {
    const sentiment = DEMO_SENTIMENT[obs.id];
    const createdAt = relativeDate(obs.time);
    const [row] = await db
      .insert(observations)
      .values({
        spaceId,
        authorName: obs.author,
        contentText: obs.text,
        signalStrength: obs.signalStrength,
        hasImage: obs.hasImage ?? false,
        imageLabel: obs.imageLabel ?? null,
        createdAt,
        isDemo: true,
        ...(sentiment && {
          aiSentimentData: sentiment.aiSentimentData,
          aiThemes: sentiment.aiThemes,
          aiProcessedAt: createdAt,
        }),
      })
      .returning({ id: observations.id });
    obsIdMap.set(obs.id, row.id);
  }

  // 4. Insert signals
  const sigIdMap = new Map<string, string>();
  for (const sig of SIGNALS) {
    const weeksAgo = SIGNALS.indexOf(sig);
    const firstSeen = new Date();
    firstSeen.setDate(firstSeen.getDate() - (weeksAgo + 2) * 7);

    const [row] = await db
      .insert(signals)
      .values({
        spaceId,
        title: sig.title,
        description: sig.description,
        strength: sig.strength,
        direction: sig.direction,
        observationCount: sig.observationCount,
        contributorCount: sig.contributorCount,
        firstSeen,
        lastUpdated: new Date(),
        isDemo: true,
      })
      .returning({ id: signals.id });
    sigIdMap.set(sig.id, row.id);
  }

  // 5. Create signal_observations junction records
  // Map observations to signals by thematic relevance:
  //   obs 0 (Sarah – group energy shifted)   → s1 power dynamics, s2 community energy
  //   obs 1 (Marcus – post-its, want asked)  → s3 want to be asked, s1 power dynamics
  //   obs 2 (Priya – budget → strategy)      → s1 power dynamics, s3 want to be asked
  //   obs 3 (Tom – email tone changed)       → s4 relationships less formal, s2 community energy
  //   obs 4 (Aisha – community space busy)   → s2 community energy, s4 relationships less formal
  //   obs 5 (James – accidental innovation)  → s5 process as barrier, s3 want to be asked
  //   obs 6 (Sarah – systemic frustration)   → s1 power dynamics, s5 process as barrier, s4 relationships
  const obsIds = Array.from(obsIdMap.values());
  const sigIds = Array.from(sigIdMap.values());
  const junctionPairs: [number, number][] = [
    // s1: Power dynamics (obs 0, 1, 2, 6)
    [0, 0], [0, 1], [0, 2], [0, 6],
    // s2: Community energy (obs 0, 3, 4)
    [1, 0], [1, 3], [1, 4],
    // s3: People want to be asked (obs 1, 2, 5)
    [2, 1], [2, 2], [2, 5],
    // s4: Relationships less formal (obs 3, 4, 6)
    [3, 3], [3, 4], [3, 6],
    // s5: Process as barrier (obs 5, 6)
    [4, 5], [4, 6],
  ];
  const junctions = junctionPairs
    .filter(([s, o]) => sigIds[s] && obsIds[o])
    .map(([s, o]) => ({ signalId: sigIds[s], observationId: obsIds[o] }));

  if (junctions.length > 0) {
    await db.insert(signalObservations).values(junctions);
  }

  // 6. Insert constellation nodes with UUID connection mapping
  const nodeIdMap = new Map<number, string>();
  for (const node of CONSTELLATION_NODES) {
    const [row] = await db
      .insert(constellationNodes)
      .values({
        spaceId,
        label: node.label,
        x: node.x,
        y: node.y,
        size: node.size,
        type: node.type,
        connections: [], // placeholder, will update after all inserted
        description: node.text,
        isDemo: true,
      })
      .returning({ id: constellationNodes.id });
    nodeIdMap.set(node.id, row.id);
  }

  // Update connections with real UUIDs
  const { eq } = await import("drizzle-orm");
  for (const node of CONSTELLATION_NODES) {
    const nodeUuid = nodeIdMap.get(node.id)!;
    const connUuids = node.connections
      .map((connId) => nodeIdMap.get(connId))
      .filter(Boolean) as string[];

    await db
      .update(constellationNodes)
      .set({ connections: connUuids })
      .where(eq(constellationNodes.id, nodeUuid));
  }

  return spaceId;
}
