"use client";

import { signIn } from "next-auth/react";
import { useActionState } from "react";
import Link from "next/link";

function LoginAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  return signIn("credentials", {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    redirectTo: "/dashboard",
    redirect: false,
  }).then((result) => {
    if (result?.error) {
      return { error: "Invalid email or password" };
    }
    // Successful sign-in — redirect manually
    window.location.href = "/dashboard";
    return {};
  });
}

function MagicLinkAction(
  _prev: { error?: string; sent?: boolean },
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  return signIn("resend", {
    email: formData.get("email") as string,
    redirectTo: "/dashboard",
    redirect: false,
  }).then((result) => {
    if (result?.error) {
      return { error: "Failed to send magic link" };
    }
    window.location.href = "/check-email";
    return { sent: true };
  });
}

export function SignInForm() {
  const [loginState, loginAction, loginPending] = useActionState(
    LoginAction,
    {}
  );
  const [magicState, magicAction, magicPending] = useActionState(
    MagicLinkAction,
    {}
  );

  return (
    <>
      {/* Email + Password */}
      <form action={loginAction} className="mt-8 space-y-3">
        <label htmlFor="login-email" className="sr-only">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="Email"
          required
          aria-describedby="login-error"
          className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
        />
        <label htmlFor="login-password" className="sr-only">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          placeholder="Password"
          required
          aria-describedby="login-error"
          className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
        />
        {loginState.error && (
          <p id="login-error" role="alert" className="text-[0.8rem] text-warm-1">{loginState.error}</p>
        )}
        <button
          type="submit"
          disabled={loginPending}
          className="w-full rounded-xl bg-cool-1/20 border border-cool-1/30 px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:bg-cool-1/30 disabled:opacity-50"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <Divider />

      {/* Magic Link */}
      <form action={magicAction} className="space-y-3">
        <label htmlFor="magic-email" className="sr-only">Email for magic link</label>
        <input
          id="magic-email"
          name="email"
          type="email"
          placeholder="Email for magic link"
          required
          aria-describedby="magic-error"
          className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
        />
        {magicState.error && (
          <p id="magic-error" role="alert" className="text-[0.8rem] text-warm-1">{magicState.error}</p>
        )}
        <button
          type="submit"
          disabled={magicPending}
          className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:border-white/15 hover:bg-white/[0.08] disabled:opacity-50"
        >
          {magicPending ? "Sending…" : "Send magic link"}
        </button>
      </form>

      <Divider />

      {/* Google OAuth */}
      <button
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:border-white/15 hover:bg-white/[0.08]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-6 text-[0.82rem] text-text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-cool-1 hover:text-cool-2 transition-colors"
        >
          Create one
        </Link>
      </p>
    </>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/8" />
      <span className="text-[0.72rem] text-text-muted">or</span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}
