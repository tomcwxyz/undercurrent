import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPasswordResetToken(
  email: string
): Promise<string> {
  // Delete any existing tokens for this email
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.identifier, email));

  const rawToken = generateRandomHex(32);
  const hashedToken = await hashToken(rawToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    identifier: email,
    token: hashedToken,
    expires,
  });

  return rawToken;
}

export async function validatePasswordResetToken(
  rawToken: string
): Promise<string | null> {
  const hashedToken = await hashToken(rawToken);
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, hashedToken),
        gt(passwordResetTokens.expires, new Date())
      )
    )
    .limit(1);
  return result[0]?.identifier ?? null;
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<string | null> {
  const email = await validatePasswordResetToken(rawToken);
  if (!email) return null;

  const hashedToken = await hashToken(rawToken);
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.token, hashedToken));

  return email;
}
