"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/app/(auth)/actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, {});

  return (
    <form action={action} className="mt-8 space-y-3">
      <label htmlFor="register-name" className="sr-only">Name</label>
      <input
        id="register-name"
        name="name"
        type="text"
        placeholder="Name"
        required
        aria-describedby="register-error"
        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />
      <label htmlFor="register-email" className="sr-only">Email</label>
      <input
        id="register-email"
        name="email"
        type="email"
        placeholder="Email"
        required
        aria-describedby="register-error"
        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />
      <label htmlFor="register-password" className="sr-only">Password</label>
      <input
        id="register-password"
        name="password"
        type="password"
        placeholder="Password (8+ characters)"
        required
        minLength={8}
        aria-describedby="register-error"
        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />
      <TurnstileWidget />
      {state.error && (
        <p id="register-error" role="alert" className="text-[0.8rem] text-warm-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cool-1/20 border border-cool-1/30 px-5 py-3 text-[0.88rem] font-medium text-text-primary transition-all hover:bg-cool-1/30 disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="mt-4 text-[0.82rem] text-text-muted">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-cool-1 hover:text-cool-2 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
