import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { getUserByEmail, verifyPassword } from "@/lib/auth-utils";
import { isDemoAccount } from "@/lib/account";
import { resetDemoAccount } from "@/lib/db/queries";
import { buildMagicLinkEmail } from "@/lib/email/magic-link-template";
import { checkRateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google,
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
      async sendVerificationRequest({ identifier: to, url, provider, request }) {
        // Throttle sign-in email dispatch to curb spam-signup abuse (bots
        // triggering NextAuth's magic-link send for arbitrary addresses).
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const [ipAllowed, emailAllowed] = await Promise.all([
          checkRateLimit(`signin-email:ip:${ip}`, 5, 60 * 60 * 1000),
          checkRateLimit(`signin-email:addr:${to}`, 3, 60 * 60 * 1000),
        ]);
        if (!ipAllowed || !emailAllowed) {
          throw new Error("Too many sign-in requests. Please try again later.");
        }

        const { host } = new URL(url);
        const { subject, html, text } = buildMagicLinkEmail({ url, host });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: provider.from, to, subject, html, text }),
        });

        if (!res.ok) {
          throw new Error("Resend error: " + JSON.stringify(await res.json()));
        }
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email as string | undefined;
        const password = credentials.password as string | undefined;
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/check-email",
  },
  events: {
    async signOut(message) {
      // Reset demo account data on signout so next login gets fresh seed
      if ("token" in message && message.token?.email) {
        if (isDemoAccount(message.token.email as string)) {
          const userId = message.token.id as string;
          if (userId) await resetDemoAccount(userId);
        }
      }
    },
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isProtected =
        request.nextUrl.pathname.startsWith("/dashboard") ||
        request.nextUrl.pathname.startsWith("/onboarding");
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
