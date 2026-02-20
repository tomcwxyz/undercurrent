"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/account";
import { updateUser, deleteUser, updateSpace, deleteSpace } from "@/lib/db/queries";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (!isSuperAdmin(session.user.email)) throw new Error("Not authorized");
  return session;
}

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
});

export async function adminUpdateUser(formData: FormData) {
  await requireSuperAdmin();

  const parsed = updateUserSchema.parse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
  });

  await updateUser(parsed.userId, { name: parsed.name, email: parsed.email });
  revalidatePath("/admin");
}

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

export async function adminDeleteUser(formData: FormData) {
  await requireSuperAdmin();

  const parsed = deleteUserSchema.parse({
    userId: formData.get("userId"),
  });

  await deleteUser(parsed.userId);
  revalidatePath("/admin");
}

const updateSpaceSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function adminUpdateSpace(formData: FormData) {
  await requireSuperAdmin();

  const parsed = updateSpaceSchema.parse({
    spaceId: formData.get("spaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  await updateSpace(parsed.spaceId, {
    name: parsed.name,
    description: parsed.description ?? null,
  });
  revalidatePath("/admin");
}

const deleteSpaceSchema = z.object({
  spaceId: z.string().uuid(),
});

export async function adminDeleteSpace(formData: FormData) {
  await requireSuperAdmin();

  const parsed = deleteSpaceSchema.parse({
    spaceId: formData.get("spaceId"),
  });

  await deleteSpace(parsed.spaceId);
  revalidatePath("/admin");
}
