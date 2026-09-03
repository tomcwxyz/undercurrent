import { generateObject } from "ai";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations, signalObservations, signals } from "@/lib/db/schema";
import { getR1AskModel } from "../providers/registry";
import { zodToAISchema } from "../schema";

const answerSchema = z.object({
  answer: z.string().min(1).max(900),
  evidenceRefs: z.array(z.string()).max(6),
  confidence: z.enum(["low", "medium", "high"]),
  caveat: z.string().max(300).nullable(),
});

export type SignalAskAnswer = {
  answer: string;
  confidence: "low" | "medium" | "high";
  caveat: string | null;
  evidence: {
    id: string;
    createdAt: string;
    preview: string;
  }[];
  evidenceAvailable: number;
};

type EvidenceRow = {
  id: string;
  createdAt: Date;
  contentText: string;
};

function dedupeEvidence(rows: EvidenceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function askSignal({
  spaceId,
  signalId,
  question,
}: {
  spaceId: string;
  signalId: string;
  question: string;
}): Promise<SignalAskAnswer> {
  const [signal] = await db
    .select({
      id: signals.id,
      title: signals.title,
      description: signals.description,
      strength: signals.strength,
      direction: signals.direction,
      observationCount: signals.observationCount,
      contributorCount: signals.contributorCount,
      firstSeen: signals.firstSeen,
      lastUpdated: signals.lastUpdated,
    })
    .from(signals)
    .where(
      and(
        eq(signals.id, signalId),
        eq(signals.spaceId, spaceId),
        eq(signals.status, "active"),
      ),
    )
    .limit(1);

  if (!signal) {
    throw new Error("Signal not found");
  }

  const evidenceWhere = and(
    eq(signalObservations.signalId, signalId),
    eq(observations.spaceId, spaceId),
    eq(observations.moderationStatus, "approved"),
    isNotNull(observations.aiProcessedAt),
  );

  // Keep the model context deliberately bounded while retaining both origin
  // evidence and the most recent movement in the swell.
  const [earliest, latest] = await Promise.all([
    db
      .select({
        id: observations.id,
        createdAt: observations.createdAt,
        contentText: observations.contentText,
      })
      .from(signalObservations)
      .innerJoin(
        observations,
        eq(observations.id, signalObservations.observationId),
      )
      .where(evidenceWhere)
      .orderBy(asc(observations.createdAt))
      .limit(6),
    db
      .select({
        id: observations.id,
        createdAt: observations.createdAt,
        contentText: observations.contentText,
      })
      .from(signalObservations)
      .innerJoin(
        observations,
        eq(observations.id, signalObservations.observationId),
      )
      .where(evidenceWhere)
      .orderBy(desc(observations.createdAt))
      .limit(18),
  ]);

  const evidence = dedupeEvidence([...earliest, ...latest])
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 24);

  const labelled = evidence.map((row, index) => ({
    ref: `E${index + 1}`,
    ...row,
  }));

  const evidenceText = labelled.length
    ? labelled
        .map(
          (row) =>
            `[${row.ref}] ${row.createdAt.toISOString().slice(0, 10)} — ${row.contentText.slice(0, 1200)}`,
        )
        .join("\n")
    : "(No processed linked observations are available yet.)";

  const { object } = await generateObject({
    model: getR1AskModel(),
    schema: zodToAISchema(answerSchema),
    prompt: `You are answering one bounded question about one signal in Swells, an organisational sensing tool.

Signal:
Title: ${signal.title}
Description: ${signal.description ?? "(none)"}
Strength: ${signal.strength}
Direction: ${signal.direction}
Signal observation count: ${signal.observationCount ?? 0}
Contributors: ${signal.contributorCount ?? 0}
First seen: ${signal.firstSeen.toISOString()}
Last updated: ${signal.lastUpdated.toISOString()}

Question:
${question}

Exact linked evidence available to you:
${evidenceText}

Rules:
- Use only the signal metadata and evidence above.
- Do not use outside knowledge.
- Do not invent observations, causes, people or events.
- Separate direct evidence from inference.
- If the evidence cannot answer the question, say so plainly.
- "Contradiction" means evidence that points against, complicates, or does not fit the dominant interpretation. Do not manufacture disagreement.
- Keep the answer concise enough to read or hear on a Rabbit R1: normally 2–4 short sentences.
- evidenceRefs must contain only labels like E1, E2 that materially support the answer.
- confidence is about how well the supplied evidence supports this answer, not how important the signal is.
- caveat should be null unless one short qualification materially helps.
- Do not propose or perform any change to the signal.
- Use British English.`,
  });

  const result = object as z.infer<typeof answerSchema>;
  const evidenceByRef = new Map(labelled.map((row) => [row.ref, row]));

  return {
    answer: result.answer,
    confidence: result.confidence,
    caveat: result.caveat,
    evidence: result.evidenceRefs
      .map((ref) => evidenceByRef.get(ref))
      .filter((row): row is (typeof labelled)[number] => Boolean(row))
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        preview: row.contentText.slice(0, 180),
      })),
    evidenceAvailable: evidence.length,
  };
}
