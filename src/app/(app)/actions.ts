"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { observations } from "@/lib/db/schema";
import { clearDemoData } from "@/lib/db/queries";

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

  await db.insert(observations).values({
    spaceId: parsed.spaceId,
    authorId: session.user.id,
    authorName: session.user.name ?? "Anonymous",
    contentText: parsed.text,
    signalStrength: "single",
  });

  revalidatePath("/dashboard");
}

export async function clearDemoDataAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string") throw new Error("Invalid spaceId");

  await clearDemoData(spaceId);
  revalidatePath("/dashboard");
}
