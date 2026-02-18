"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations, reflectionResponses } from "@/lib/db/schema";
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
} from "@/lib/db/queries";
import { canEditSpace, canManageMembers, canDeleteSpace } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import { processObservation } from "@/lib/ai/pipeline";

const createObservationSchema = z.object({
  text: z.string().min(1).max(5000),
  spaceId: z.string().uuid(),
});

export async function createObservation(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createObservationSchema.parse({
    text: formData.get("text"),
    spaceId: formData.get("spaceId"),
  });

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: parsed.spaceId,
      authorId: session.user.id,
      authorName: session.user.name ?? "Anonymous",
      contentText: parsed.text,
      signalStrength: "single",
    })
    .returning({ id: observations.id });

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

  await db.insert(reflectionResponses).values({
    reflectionId: parsed.reflectionId,
    userId: session.user.id,
    authorName: session.user.name ?? "Anonymous",
    text: parsed.text,
  });

  revalidatePath("/dashboard", "layout");
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
});

export async function updateSpaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateSpaceSchema.parse({
    spaceId: formData.get("spaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const role = await getMemberRole(session.user.id, parsed.spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) throw new Error("Not authorized");

  await updateSpace(parsed.spaceId, { name: parsed.name, description: parsed.description ?? null });
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

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000); // 7 days

  await createInvitation(parsed.spaceId, parsed.email, parsed.role, session.user.id, token, expiresAt);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return { link: `${baseUrl}/invite/${token}` };
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
