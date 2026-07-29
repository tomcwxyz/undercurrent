"use server";

import { z } from "zod";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  hashPassword,
  getUserByEmail,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { AuthError } from "next-auth";
import { getBaseUrl } from "@/lib/env";
import { headers } from "next/headers";
import { verifyTurnstileToken } from "@/lib/turnstile";

async function requestIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim();
}

/**
 * Verifies a Turnstile token from a client-driven auth flow (e.g. the
 * next-auth/react `signIn()` calls in sign-in-form.tsx, which don't pass
 * through a server action of their own).
 */
export async function verifyCaptcha(token: string | null): Promise<boolean> {
  return verifyTurnstileToken(token, await requestIp());
}

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type ActionState = {
  error?: string;
  success?: boolean;
};

export async function register(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const captchaOk = await verifyTurnstileToken(
    formData.get("cf-turnstile-response") as string | null,
    await requestIp()
  );
  if (!captchaOk) {
    return { error: "Captcha verification failed. Please try again." };
  }

  const { name, email, password } = parsed.data;

  const existing = await getUserByEmail(email);
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    name,
    email,
    passwordHash,
    emailVerified: new Date(),
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Failed to sign in after registration" };
    }
    throw error; // next/navigation redirect throws — let it propagate
  }

  return { success: true };
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export async function forgotPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email } = parsed.data;

  // Always return success to prevent email enumeration
  const user = await getUserByEmail(email);
  if (user) {
    const token = await createPasswordResetToken(email);
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
      to: email,
      subject: "Reset your password — swells",
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }

  return { success: true };
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { token, password } = parsed.data;

  const email = await consumePasswordResetToken(token);
  if (!email) {
    return { error: "Invalid or expired reset link" };
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email));

  return { success: true };
}
