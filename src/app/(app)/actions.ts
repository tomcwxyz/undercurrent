"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations, observationMedia } from "@/lib/db/schema";
import { surfaceCaptureReviews } from "@/lib/db/surface-schema";
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
  incrementObservationCount,
  getSpaceMemberCount,
  createCollection,
  updateCollection,
  deleteCollection,
  incrementCollectionResponseCount,
  getReflectionById,
  setEmailDigestPreference,
} from "@/lib/db/queries";
import { toCollectionView } from "@/lib/db/transforms";
import { eq } from "drizzle-orm";
import { canEditSpace, canManageMembers, canDeleteSpace, canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import { processObservation, processReflectionResponse, IMAGE_OBSERVATION_PLACEHOLDER } from "@/lib/ai/pipeline";
import { seedSpaceContent } from "@/lib/db/seed";
import { checkSubscriptionAccess, checkObservationLimit } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/env";

function generateCollectionToken(): string {
  return randomBytes(9).toString("base64url"); // 12 URL-safe chars
}

const createObservationSchema = z.object({
  text: z.string().max(5000).optional(),
  spaceId: z.string().uuid(),
  surface: z.enum(["r1", "tablet"]).optional(),
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
    surface: formData.get("surface") || undefined,
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
  const contentText = hasText ? parsed.text!.trim() : IMAGE_OBSERVATION_PLACEHOLDER;

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) throw new Error("Not authorized for this space");

  // Check subscription access
  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) throw new Error(`Subscription ${access.reason}`);

  // Check observation limits — per account, across all the user's spaces
  // (skip for free-access accounts).
  const { ok: withinLimit, subscription } = await checkObservationLimit(session.user.id, session.user.email);
  if (!withinLimit) throw new Error("Monthly observation limit reached");

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: parsed.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText,
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

  if (parsed.surface === "r1") {
    await db
      .insert(surfaceCaptureReviews)
      .values({
        userId: session.user.id,
        spaceId: parsed.spaceId,
        observationId: inserted.id,
        surface: "r1",
      })
      .onConflictDoNothing();
  }

  // Track usage
  if (subscription) {
    await incrementObservationCount(subscription.id, parsed.spaceId);
  }

  revalidatePath("/dashboard", "layout");

  after(() => processObservation(inserted.id, parsed.spaceId));

  return { id: inserted.id };
}

export async function clearDemoDataAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized for this space");

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

  const role = await getMemberRole(session.user.id, reflection.spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) throw new Error("Not authorized for this space");

  const access = await checkSubscriptionAccess(session.user.id, session.user.email);
  if (!access.allowed) throw new Error(`Subscription ${access.reason}`);

  const { ok: withinLimit, subscription } = await checkObservationLimit(session.user.id, session.user.email);
  if (!withinLimit) throw new Error("Monthly observation limit reached");

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: reflection.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: parsed.text.trim(),
      signalStrength: "single",
      reflectionId: reflection.id,
    })
    .returning({ id: observations.id });

  if (subscription) {
    await incrementObservationCount(subscription.id, reflection.spaceId);
  }

  revalidatePath("/dashboard", "layout");
  after(() => processReflectionResponse(inserted.id, reflection.spaceId, (reflection.signalIds as string[]) ?? []));
}

// ── Space actions ──

export async function createSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = formData.get("name");
  const description = formData.get("description");
  if (typeof name !== "string" || !name.trim()) throw new Error("Name is required");

  const spaceId = await createSpace(name.trim(), typeof description === "string" ? description.trim() || null : null, session.user.id);
  await seedSpaceContent(spaceId, session.user.id);
  redirect(`/dashboard/${spaceId}`);
}

export async function updateSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  const name = formData.get("name");
  const description = formData.get("description");
  if (typeof spaceId !== "string" || typeof name !== "string" || !name.trim()) {
    throw new Error("Invalid space settings");
  }

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized for this space");

  await updateSpace(spaceId, {
    name: name.trim(),
    description: typeof description === "string" ? description.trim() || null : null,
  });
  revalidatePath("/dashboard", "layout");
}

export async function deleteSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canDeleteSpace(role as SpaceRole)) throw new Error("Not authorized for this space");

  await deleteSpace(spaceId);
  redirect("/dashboard");
}

export async function inviteMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  const email = formData.get("email");
  const role = formData.get("role");
  if (typeof spaceId !== "string" || typeof email !== "string" || typeof role !== "string") {
    throw new Error("Invalid invitation");
  }

  const currentRole = await getMemberRole(session.user.id, spaceId);
  if (!currentRole || !canManageMembers(currentRole as SpaceRole)) throw new Error("Not authorized for this space");

  const normalizedEmail = email.trim().toLowerCase();
  const token = generateCollectionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createInvitation(spaceId, normalizedEmail, role, session.user.id, token, expiresAt);

  revalidatePath("/dashboard", "layout");
}

export async function updateMemberRoleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof spaceId !== "string" || typeof userId !== "string" || typeof role !== "string") {
    throw new Error("Invalid member update");
  }

  const currentRole = await getMemberRole(session.user.id, spaceId);
  if (!currentRole || !canManageMembers(currentRole as SpaceRole)) throw new Error("Not authorized for this space");
  await updateMemberRole(userId, spaceId, role);
  revalidatePath("/dashboard", "layout");
}

export async function removeMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  const userId = formData.get("userId");
  if (typeof spaceId !== "string" || typeof userId !== "string") throw new Error("Invalid member removal");

  const currentRole = await getMemberRole(session.user.id, spaceId);
  if (!currentRole || !canManageMembers(currentRole as SpaceRole)) throw new Error("Not authorized for this space");
  await removeMember(userId, spaceId);
  revalidatePath("/dashboard", "layout");
}

export async function updateEmailDigestPreferenceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const spaceId = formData.get("spaceId");
  const enabled = formData.get("enabled");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role) throw new Error("Not authorized for this space");
  await setEmailDigestPreference(session.user.id, spaceId, enabled === "true");
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string") throw new Error("Invalid notification");
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

export async function createCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  const title = formData.get("title");
  const description = formData.get("description");
  if (typeof spaceId !== "string" || typeof title !== "string" || !title.trim()) {
    throw new Error("Invalid collection");
  }

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized for this space");

  const token = generateCollectionToken();
  const collection = await createCollection({
    spaceId,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() || null : null,
    token,
  });
  revalidatePath("/dashboard", "layout");
  return toCollectionView(collection, getBaseUrl());
}

export async function updateCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const collectionId = formData.get("collectionId");
  const spaceId = formData.get("spaceId");
  const title = formData.get("title");
  const description = formData.get("description");
  if (typeof collectionId !== "string" || typeof spaceId !== "string" || typeof title !== "string" || !title.trim()) {
    throw new Error("Invalid collection update");
  }

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized for this space");
  await updateCollection(collectionId, {
    title: title.trim(),
    description: typeof description === "string" ? description.trim() || null : null,
  });
  revalidatePath("/dashboard", "layout");
}

export async function deleteCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const collectionId = formData.get("collectionId");
  const spaceId = formData.get("spaceId");
  if (typeof collectionId !== "string" || typeof spaceId !== "string") throw new Error("Invalid collection deletion");
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized for this space");
  await deleteCollection(collectionId);
  revalidatePath("/dashboard", "layout");
}

export async function incrementCollectionResponseCountAction(collectionId: string) {
  await incrementCollectionResponseCount(collectionId);
}
