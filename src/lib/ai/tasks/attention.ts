import { generateObject } from "ai";
import { z } from "zod";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations, signals, reflections } from "@/lib/db/schema";
import { getAttentionModel } from "../providers/registry";
import { zodToAISchema } from "../schema";
import { AI_CONFIG } from "../config";

const attentionSchema = z.object({
  dominantThemes: z.array(z.string()).max(10),
  absentThemes: z.array(z.string()).max(10),
  attentionShifts: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      significance: z.string(),
    })
  ),
  metaReflectionPrompt: z.string().max(1000),
});

/**
 * Run a comprehensive attention analysis across a space.
 * Looks at 30 days of observations + current signals to find patterns
 * in what's being noticed and what's being missed.
 */
export async function runAttentionAnalysis(spaceId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AI_CONFIG.attention.lookbackDays);

  // Gather recent observations and current signals
  const [recentObs, currentSignals] = await Promise.all([
    db
      .select({
        contentText: observations.contentText,
        aiThemes: observations.aiThemes,
        aiSentimentData: observations.aiSentimentData,
        createdAt: observations.createdAt,
      })
      .from(observations)
      .where(
        and(
          eq(observations.spaceId, spaceId),
          eq(observations.isDemo, false),
          gt(observations.createdAt, cutoff)
        )
      )
      .orderBy(desc(observations.createdAt)),
    db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.spaceId, spaceId),
          eq(signals.isDemo, false)
        )
      ),
  ]);

  if (recentObs.length === 0) {
    console.log(`[attention] No observations in space ${spaceId} in last ${AI_CONFIG.attention.lookbackDays} days`);
    return;
  }

  const obsTexts = recentObs
    .map(
      (o, i) =>
        `${i + 1}. [${o.createdAt.toISOString().slice(0, 10)}] ${o.contentText}${
          o.aiThemes?.length ? ` (themes: ${o.aiThemes.join(", ")})` : ""
        }`
    )
    .join("\n");

  const signalTexts = currentSignals
    .map(
      (s) =>
        `- "${s.title}" (${s.strength}, ${s.direction}, ${s.observationCount} obs)`
    )
    .join("\n");

  const { object } = await generateObject({
    model: getAttentionModel(),
    schema: zodToAISchema(attentionSchema),
    prompt: `You are performing a meta-level attention analysis for an organisational sensing platform. Your job is to see what the observers are seeing — and what they might be missing.

Recent observations (last ${AI_CONFIG.attention.lookbackDays} days):
${obsTexts}

Current signals:
${signalTexts || "(none yet)"}

Analyse:
1. dominantThemes: What themes keep appearing? What's getting the most attention?
2. absentThemes: What might be conspicuously absent? What topics or domains seem under-represented given the context?
3. attentionShifts: Have there been shifts in what people are noticing? (from → to, with significance)
4. metaReflectionPrompt: A profound question that helps the group reflect on their collective attention patterns. This should be at the "triple loop" level — questioning the very frames through which they see.`,
  });

  const result = object as z.infer<typeof attentionSchema>;

  await db.insert(reflections).values({
    spaceId,
    type: "scheduled",
    prompt: result.metaReflectionPrompt,
    signalIds: currentSignals.map((s) => s.id),
    synthesis: JSON.stringify({
      dominantThemes: result.dominantThemes,
      absentThemes: result.absentThemes,
      attentionShifts: result.attentionShifts,
    }),
    learningLoop: "triple",
    triggerType: "weekly_attention_analysis",
  });
}
