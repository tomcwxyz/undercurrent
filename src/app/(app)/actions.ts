"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations, observationMedia } from "@/lib/db/schema";
import {
  clearDemoData,
  markNotificationRead,
  markAllNotificationsRead,
  getMemberRole,
  updateSpace,
  createInvitation,
  updateMemberRole,
  removeMember,
  deleteSpace,
  createSpace,
  getSubscriptionForUser,
  getObservationCountThisMonth,
  incrementObservationCount,
  getSpaceMemberCount,
  createCollection,
  updateCollection,
  deleteCollection,
  incrementCollectionResponseCount,
  getReflectionById,
} from "@/lib/db/queries";
import { toCollectionView } from "@/lib/db/transforms";
import { eq } from "drizzle-orm";
import { canEditSpace, canManageMembers, canDeleteSpace } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import { processObservation, processReflectionResponse, IMAGE_OBSERVATION_PLACEHOLDER } from "@/lib/ai/pipeline";
import { checkSubscriptionAccess, getTierConfig } from "@/lib/stripe";
import { hasFreeAccess } from "@/lib/account";
import { getBaseUrl } from "@/lib/env";

function generateCollectionToken(): string {
  return randomBytes(9).toString("base64url"); // 12 URL-safe chars
}

const createObservationSchema = z.object({
  text: z.string().max(5000).optional(),
  spaceId: z.string().uuid(),
});

const mediaRefSchema = z.array(
  z.object({
    key: z.string(),
    url: z.string(),
    type: z.enum(["image", "voice", "file"]),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
  })
);

export async function createObservation(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createObservationSchema.parse({
    text: formData.get("text"),
    spaceId: formData.get("spaceId"),
  });

  // Parse optional media refs
  const mediaKeysRaw = formData.get("mediaKeys");
  const mediaRefs = mediaKeysRaw
    ? mediaRefSchema.parse(JSON.parse(mediaKeysRaw as string))
    : [];

  // Require text OR at least one media attachment
  const hasText = !!parsed.text?.trim();
  const hasMedia = mediaRefs.length > 0;
  if (!hasText && !hasMedia) {
    throw new Error("Please add some text or attach a recording, image, or file");
  }

  // Check subscription access
  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) throw new Error(`Subscription ${access.reason}`);

  // Check observation limits (skip for free-access accounts)
  const subscription = await getSubscriptionForUser(session.user.id);
  if (subscription && !hasFreeAccess(session.user.email)) {
    const config = getTierConfig(subscription.tier);
    const count = await getObservationCountThisMonth(parsed.spaceId);
    if (count >= config.observationLimit) {
      throw new Error("Monthly observation limit reached");
    }
  }

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: parsed.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: hasText ? parsed.text! : IMAGE_OBSERVATION_PLACEHOLDER,
      signalStrength: "single",
    })
    .returning({ id: observations.id });

  // Insert media rows
  if (mediaRefs.length > 0) {
    await db.insert(observationMedia).values(
      mediaRefs.map((m) => ({
        observationId: inserted.id,
        type: m.type,
        storageKey: m.key,
        url: m.url,
        fileName: m.fileName,
        mimeType: m.mimeType,
        fileSize: m.fileSize,
      }))
    );
  }

  // Track usage
  if (subscription) {
    await incrementObservationCount(subscription.id, parsed.spaceId);
  }

  revalidatePath("/dashboard", "layout");

  after(() => processObservation(inserted.id, parsed.spaceId));
}

export async function clearDemoDataAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  await clearDemoData(spaceId);
  revalidatePath("/dashboard", "layout");
}

const submitReflectionResponseSchema = z.object({
  reflectionId: z.string().uuid(),
  text: z.string().min(1).max(5000),
});

export async function submitReflectionResponse(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = submitReflectionResponseSchema.parse({
    reflectionId: formData.get("reflectionId"),
    text: formData.get("text"),
  });

  // A response is a considered sensing input: it becomes an observation linked
  // to its reflection, then re-enters the AI pipeline to evolve the signal(s)
  // that prompted it.
  const reflection = await getReflectionById(parsed.reflectionId);
  if (!reflection) throw new Error("Reflection not found");

  const spaceId = reflection.spaceId;
  const signalIds = (reflection.signalIds as string[] | null) ?? [];

  // Subscription gating mirrors createObservation — responses count as
  // observations against the monthly limit.
  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) throw new Error(`Subscription ${access.reason}`);

  const subscription = await getSubscriptionForUser(session.user.id);
  if (subscription && !hasFreeAccess(session.user.email)) {
    const config = getTierConfig(subscription.tier);
    const count = await getObservationCountThisMonth(spaceId);
    if (count >= config.observationLimit) {
      throw new Error("Monthly observation limit reached");
    }
  }

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: parsed.text,
      signalStrength: "single",
      reflectionId: parsed.reflectionId,
    })
    .returning({ id: observations.id });

  if (subscription) {
    await incrementObservationCount(subscription.id, spaceId);
  }

  revalidatePath("/dashboard", "layout");

  after(() => processReflectionResponse(inserted.id, spaceId, signalIds));
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string") throw new Error("Invalid notificationId");

  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  await markAllNotificationsRead(session.user.id, spaceId);
  revalidatePath("/dashboard", "layout");
}

// ── Space management actions ──

const updateSpaceSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  environment: z.enum(["stars", "water", "mycelium"]).optional(),
});

export async function updateSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateSpaceSchema.parse({
    spaceId: formData.get("spaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    environment: formData.get("environment") || undefined,
  });

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized");

  await updateSpace(parsed.spaceId, {
    name: parsed.name,
    description: parsed.description ?? null,
    environment: parsed.environment,
  });
  revalidatePath("/dashboard", "layout");
}

const inviteSchema = z.object({
  spaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "facilitator", "observer", "viewer"]),
});

export async function inviteToSpaceAction(formData: FormData): Promise<{ link: string } | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = inviteSchema.parse({
    spaceId: formData.get("spaceId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canManageMembers(role as SpaceRole)) throw new Error("Not authorized");

  // Check user limit from subscription
  const subscription = await getSubscriptionForUser(session.user.id);
  if (subscription) {
    const memberCount = await getSpaceMemberCount(parsed.spaceId);
    if (memberCount >= subscription.userLimit) {
      throw new Error("Space member limit reached for your plan");
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000); // 7 days

  await createInvitation(parsed.spaceId, parsed.email, parsed.role, session.user.id, token, expiresAt);

  return { link: `${getBaseUrl()}/invite/${token}` };
}

const memberActionSchema = z.object({
  spaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function updateMemberRoleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = memberActionSchema.parse({
    spaceId: formData.get("spaceId"),
    userId: formData.get("userId"),
  });
  const newRole = z.enum(["admin", "facilitator", "observer", "viewer"]).parse(formData.get("role"));

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canManageMembers(role as SpaceRole)) throw new Error("Not authorized");

  await updateMemberRole(parsed.userId, parsed.spaceId, newRole);
  revalidatePath("/dashboard", "layout");
}

export async function removeMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = memberActionSchema.parse({
    spaceId: formData.get("spaceId"),
    userId: formData.get("userId"),
  });

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canManageMembers(role as SpaceRole)) throw new Error("Not authorized");

  await removeMember(parsed.userId, parsed.spaceId);
  revalidatePath("/dashboard", "layout");
}

export async function deleteSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = z.string().uuid().parse(formData.get("spaceId"));

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canDeleteSpace(role as SpaceRole)) throw new Error("Not authorized");

  await deleteSpace(spaceId);
  redirect("/dashboard");
}

const createSpaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function createSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createSpaceSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const spaceId = await createSpace(parsed.name, parsed.description ?? null, session.user.id);
  redirect(`/dashboard/${spaceId}`);
}

// ── Collection actions ──

const createCollectionSchema = z.object({
  spaceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  closeAt: z.string().datetime().optional(),
  maxResponses: z.coerce.number().int().positive().optional(),
  moderationEnabled: z.coerce.boolean().optional(),
});

export async function createCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createCollectionSchema.parse(Object.fromEntries(formData));
  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Permission denied");

  const baseUrl = getBaseUrl();
  const row = await createCollection({
    spaceId: parsed.spaceId,
    title: parsed.title,
    description: parsed.description ?? null,
    token: generateCollectionToken(),
    closeAt: parsed.closeAt ? new Date(parsed.closeAt) : null,
    maxResponses: parsed.maxResponses ?? null,
    moderationEnabled: parsed.moderationEnabled ?? false,
  });

  revalidatePath(`/dashboard/${parsed.spaceId}`);
  return toCollectionView(row, baseUrl);
}

const updateCollectionSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isOpen: z.coerce.boolean().optional(),
  closeAt: z.string().datetime().optional().nullable(),
  maxResponses: z.coerce.number().int().positive().optional().nullable(),
  moderationEnabled: z.coerce.boolean().optional(),
});

export async function updateCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateCollectionSchema.parse(Object.fromEntries(formData));
  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Permission denied");

  await updateCollection(parsed.id, {
    title: parsed.title,
    description: parsed.description,
    isOpen: parsed.isOpen,
    closeAt: parsed.closeAt
      ? new Date(parsed.closeAt)
      : parsed.closeAt === null
      ? null
      : undefined,
    maxResponses: parsed.maxResponses,
    moderationEnabled: parsed.moderationEnabled,
  });

  revalidatePath(`/dashboard/${parsed.spaceId}`);
}

export async function deleteCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().uuid().parse(formData.get("id"));
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Permission denied");

  await deleteCollection(id);
  revalidatePath(`/dashboard/${spaceId}`);
}

export async function moderateObservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const obsId = z.string().uuid().parse(formData.get("observationId"));
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const collectionId = z.string().uuid().parse(formData.get("collectionId"));
  const action = z.enum(["approve", "reject"]).parse(formData.get("action"));

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Permission denied");

  const newStatus = action === "approve" ? "approved" : "rejected";
  await db
    .update(observations)
    .set({ moderationStatus: newStatus })
    .where(eq(observations.id, obsId));

  if (action === "approve") {
    await incrementCollectionResponseCount(collectionId);
    after(async () => {
      await processObservation(obsId, spaceId);
    });
  }

  revalidatePath(`/dashboard/${spaceId}`);
}
