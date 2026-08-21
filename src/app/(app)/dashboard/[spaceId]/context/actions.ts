"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contextPrompts } from "@/lib/db/context-schema";
import { observations } from "@/lib/db/schema";
import { getMemberRole, incrementObservationCount } from "@/lib/db/queries";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import {
  checkObservationLimit,
  checkSubscriptionAccess,
} from "@/lib/stripe";
import { processObservation } from "@/lib/ai/pipeline";

const promptActionSchema = z.object({
  promptId: z.string().uuid(),
  spaceId: z.string().uuid(),
});

const keepPromptSchema = promptActionSchema.extend({
  text: z.string().trim().min(1).max(5000),
});

async function requireOwnedPendingPrompt(
  userId: string,
  promptId: string,
  spaceId: string,
) {
  const [prompt] = await db
    .select()
    .from(contextPrompts)
    .where(
      and(
        eq(contextPrompts.id, promptId),
        eq(contextPrompts.userId, userId),
        eq(contextPrompts.spaceId, spaceId),
        eq(contextPrompts.status, "pending"),
      ),
    )
    .limit(1);
  if (!prompt) throw new Error("Prompt not found");
  return prompt;
}

export async function dismissContextPrompt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = promptActionSchema.parse({
    promptId: formData.get("promptId"),
    spaceId: formData.get("spaceId"),
  });
  await requireOwnedPendingPrompt(
    session.user.id,
    parsed.promptId,
    parsed.spaceId,
  );

  await db
    .update(contextPrompts)
    .set({ status: "dismissed", resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(contextPrompts.id, parsed.promptId));

  revalidatePath(`/dashboard/${parsed.spaceId}/context`);
}

export async function keepContextPrompt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = keepPromptSchema.parse({
    promptId: formData.get("promptId"),
    spaceId: formData.get("spaceId"),
    text: formData.get("text"),
  });
  await requireOwnedPendingPrompt(
    session.user.id,
    parsed.promptId,
    parsed.spaceId,
  );

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) {
    throw new Error("Not authorized for this space");
  }

  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) throw new Error(`Subscription ${access.reason}`);

  const { ok: withinLimit, subscription } = await checkObservationLimit(
    session.user.id,
    session.user.email,
  );
  if (!withinLimit) throw new Error("Monthly observation limit reached");

  const [observation] = await db
    .insert(observations)
    .values({
      spaceId: parsed.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: parsed.text,
      signalStrength: "single",
    })
    .returning({ id: observations.id });

  await db
    .update(contextPrompts)
    .set({
      status: "kept",
      observationId: observation.id,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contextPrompts.id, parsed.promptId));

  if (subscription) {
    await incrementObservationCount(subscription.id, parsed.spaceId);
  }

  revalidatePath(`/dashboard/${parsed.spaceId}`, "layout");
  revalidatePath(`/dashboard/${parsed.spaceId}/context`);
  after(() => processObservation(observation.id, parsed.spaceId));
}
