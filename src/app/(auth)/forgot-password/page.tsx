import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(78,205,196,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 70% 60%, rgba(255,107,74,0.04) 0%, transparent 70%), var(--color-deep)",
        }}
      />

      <div className="relative z-10 w-full max-w-[380px] text-center">
        <h1 className="font-display text-[2.4rem] font-light tracking-wide text-text-primary">
          under
          <em
            className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
            style={{ fontStyle: "italic" }}
          >
            current
          </em>
        </h1>

        <div
          className="mt-10 rounded-3xl border p-8"
          style={{
            background: "rgba(20,27,45,0.6)",
            borderColor: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
          }}
        >
          <h2 className="font-display text-[1.4rem] font-light text-text-primary">
            Forgot password
          </h2>
          <p className="mt-1 text-[0.82rem] text-text-secondary">
            enter your email to receive a reset link
          </p>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
