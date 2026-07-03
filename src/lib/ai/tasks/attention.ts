import { generateObject } from "ai";
import { z } from "zod";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { observations, signals, reflections } from "@/lib/db/schema";
import { notifySpaceMembers, getSpaceMembers, getSpaceById } from "@/lib/db/queries";
import { getAttentionModel } from "../providers/registry";
import { zodToAISchema } from "../schema";
import { AI_CONFIG } from "../config";
import { getResend, DIGEST_FROM } from "@/lib/email/resend-client";
import { buildDigestEmail } from "@/lib/email/digest-template";
import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { getBaseUrl } from "@/lib/env";

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

  if (recentObs.length < AI_CONFIG.attention.minObservations) {
    console.log(`[attention] Space ${spaceId} dormant (<${AI_CONFIG.attention.minObservations} obs in ${AI_CONFIG.attention.lookbackDays}d) — skipping`);
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

  let result: z.infer<typeof attentionSchema>;
  try {
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
    result = object as z.infer<typeof attentionSchema>;
  } catch (error) {
    console.error(`[attention] Analysis failed for space ${spaceId}:`, error);
    throw error;
  }

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

  // Let the space know the weekly attention analysis is ready to explore.
  await notifySpaceMembers(
    spaceId,
    "new_reflection",
    "This week's attention analysis",
    result.dominantThemes.length
      ? `Most attention on: ${result.dominantThemes.slice(0, 3).join(", ")}`
      : "A fresh look at what your team is noticing — and missing.",
    "reflect"
  );

  // Non-critical — the reflection is written and the in-app notification is
  // already sent above, so a digest-email failure shouldn't fail the whole
  // space's analysis run (and shouldn't mark it "failed" in the cron summary).
  try {
    await sendDigestEmails(spaceId, result, recentObs.length, currentSignals.length);
  } catch (error) {
    console.error(`[attention] Digest email setup failed for space ${spaceId} (continuing):`, error);
  }
}

/**
 * Emails the digest to members who haven't opted out. Reuses the synthesis
 * already computed above rather than re-querying the reflection — no-ops
 * quietly if Resend isn't configured yet, since in-app notifications above
 * already cover the "did they hear about it" case.
 */
async function sendDigestEmails(
  spaceId: string,
  result: z.infer<typeof attentionSchema>,
  observationCount: number,
  signalCount: number
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const [space, members] = await Promise.all([
    getSpaceById(spaceId),
    getSpaceMembers(spaceId),
  ]);
  if (!space) return;

  const recipients = members.filter((m) => m.emailDigestEnabled && m.emailVerified && m.email);
  if (recipients.length === 0) return;

  const appUrl = getBaseUrl();

  const sends = await Promise.allSettled(
    recipients.map((member) => {
      const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?userId=${member.userId}&spaceId=${spaceId}&token=${signUnsubscribeToken(member.userId, spaceId)}`;
      const { subject, html } = buildDigestEmail({
        spaceName: space.name,
        dominantThemes: result.dominantThemes,
        absentThemes: result.absentThemes,
        attentionShifts: result.attentionShifts,
        metaReflectionPrompt: result.metaReflectionPrompt,
        signalCount,
        observationCount,
        appUrl,
        unsubscribeUrl,
      });
      return resend.emails.send({
        from: DIGEST_FROM,
        to: member.email!,
        subject,
        html,
      });
    })
  );

  const failed = sends.filter((s) => s.status === "rejected").length;
  if (failed > 0) {
    console.error(`[attention] Digest email failed for ${failed}/${recipients.length} recipients in space ${spaceId}`);
  }
}
