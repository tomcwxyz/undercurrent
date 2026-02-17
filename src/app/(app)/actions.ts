"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations, reflectionResponses } from "@/lib/db/schema";
import {
  clearDemoData,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/db/queries";
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

  revalidatePath("/dashboard");

  after(() => processObservation(inserted.id, parsed.spaceId));
}

export async function clearDemoDataAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  await clearDemoData(spaceId);
  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string") throw new Error("Invalid notificationId");

  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  await markAllNotificationsRead(session.user.id, spaceId);
  revalidatePath("/dashboard");
}
