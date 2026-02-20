"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/(auth)/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {});

  if (state.success) {
    return (
      <div className="mt-8">
        <p role="alert" className="text-[0.9rem] text-text-secondary leading-relaxed">
          Your password has been reset. You can now sign in with your new
          password.
        </p>
        <Link
          href="/sign-in"
          className="mt-6 inline-block rounded-xl bg-cool-1/20 border border-cool-1/30 px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:bg-cool-1/30"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="token" value={token} />
      <label htmlFor="reset-password" className="sr-only">New password</label>
      <input
        id="reset-password"
        name="password"
        type="password"
        placeholder="New password (8+ characters)"
        required
        minLength={8}
        aria-describedby="reset-error"
        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />
      {state.error && (
        <p id="reset-error" role="alert" className="text-[0.8rem] text-warm-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cool-1/20 border border-cool-1/30 px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:bg-cool-1/30 disabled:opacity-50"
      >
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
