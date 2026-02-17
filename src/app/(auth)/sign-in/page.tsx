import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      {/* Background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(78,205,196,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 70% 60%, rgba(255,107,74,0.04) 0%, transparent 70%), var(--color-deep)",
        }}
      />

      <div className="relative z-10 w-full max-w-[380px] text-center">
        {/* Logo */}
        <h1 className="font-display text-[2.4rem] font-light tracking-wide text-text-primary">
          under
          <em
            className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
            style={{ fontStyle: "italic" }}
          >
            current
          </em>
        </h1>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-text-secondary">
          Sense what&apos;s shifting
        </p>

        {/* Sign-in card */}
        <div
          className="mt-10 rounded-3xl border p-8"
          style={{
            background: "rgba(20,27,45,0.6)",
            borderColor: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
          }}
        >
          <h2 className="font-display text-[1.4rem] font-light text-text-primary">
            Sign in
          </h2>
          <p className="mt-1 text-[0.82rem] text-text-secondary">
            to start sensing with your team
          </p>

          <SignInForm />
        </div>

        <p className="mt-6 text-[0.75rem] leading-relaxed text-text-muted">
          By signing in you agree to explore thoughtfully.
          <br />
          New accounts get demo data to help you learn the tool.
        </p>
      </div>
    </div>
  );
}
