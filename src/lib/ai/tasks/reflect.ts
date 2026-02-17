import { generateObject } from "ai";
import { z } from "zod";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  signals,
  signalSnapshots,
  reflections,
} from "@/lib/db/schema";
import { getReflectionModel } from "../providers/registry";
import { zodToAISchema } from "../schema";
import { AI_CONFIG } from "../config";

const reflectionSchema = z.object({
  prompt: z.string().max(500),
  learningLoop: z.enum(["single", "double", "triple"]),
});

/**
 * Check if a signal should trigger a reflection, and generate one if so.
 * Triggers on: strength transitions, or signals without reflections > 7 days.
 */
export async function checkReflectionTriggers(
  signalId: string,
  spaceId: string
): Promise<void> {
  const triggers: string[] = [];

  // Check for strength transition (compare last 2 snapshots)
  const snapshots = await db
    .select()
    .from(signalSnapshots)
    .where(eq(signalSnapshots.signalId, signalId))
    .orderBy(desc(signalSnapshots.snapshotAt))
    .limit(2);

  if (snapshots.length >= 2) {
    const [latest, previous] = snapshots;
    if (latest.strength !== previous.strength) {
      triggers.push(
        `Signal strength changed from "${previous.strength}" to "${latest.strength}"`
      );
    }
    if (latest.direction !== previous.direction) {
      triggers.push(
        `Signal direction changed from "${previous.direction}" to "${latest.direction}"`
      );
    }
  }

  // Check for stale signal (no reflection in > 7 days)
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - AI_CONFIG.reflection.staleSignalDays);

  const recentReflections = await db
    .select({ id: reflections.id })
    .from(reflections)
    .where(
      and(
        eq(reflections.spaceId, spaceId),
        gt(reflections.createdAt, staleCutoff),
        sql`${reflections.signalIds}::jsonb @> ${JSON.stringify([signalId])}::jsonb`
      )
    )
    .limit(1);

  if (recentReflections.length === 0 && snapshots.length > 0) {
    triggers.push("No reflection generated for this signal in the past 7 days");
  }

  if (triggers.length === 0) return;

  // Get signal details for the prompt
  const [signal] = await db
    .select()
    .from(signals)
    .where(eq(signals.id, signalId))
    .limit(1);

  if (!signal) return;

  const { object } = await generateObject({
    model: getReflectionModel(),
    schema: zodToAISchema(reflectionSchema),
    prompt: `You are a sense-making assistant for an organisational sensing platform. A signal has triggered a reflection.

Signal: "${signal.title}"
Description: ${signal.description}
Strength: ${signal.strength}, Direction: ${signal.direction}
Observation count: ${signal.observationCount}

Trigger reasons:
${triggers.map((t) => `- ${t}`).join("\n")}

Generate a reflection prompt that:
1. Invites the user to think more deeply about this signal
2. Asks a question that could reveal hidden assumptions or blind spots
3. Is open-ended and thought-provoking (not yes/no)

Also assign a learning loop level:
- "single": What is happening? (observation-level)
- "double": Why is this happening? What assumptions are we making? (pattern-level)
- "triple": What does this tell us about how we see the world? (system-level)`,
  });

  const result = object as z.infer<typeof reflectionSchema>;

  await db.insert(reflections).values({
    spaceId,
    type: "prompted",
    prompt: result.prompt,
    signalIds: [signalId],
    learningLoop: result.learningLoop,
    triggerType: triggers[0],
  });
}
