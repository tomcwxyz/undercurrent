"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/app/(auth)/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, {});

  if (state.success) {
    return (
      <div className="mt-8">
        <p className="text-[0.9rem] text-text-secondary leading-relaxed">
          If an account exists with that email, we&apos;ve sent a reset link.
          Check your inbox.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block text-[0.82rem] text-cool-1 hover:text-cool-2 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />
      {state.error && (
        <p className="text-[0.8rem] text-warm-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cool-1/20 border border-cool-1/30 px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:bg-cool-1/30 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="mt-4 text-[0.82rem] text-text-muted">
        <Link
          href="/sign-in"
          className="text-cool-1 hover:text-cool-2 transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
