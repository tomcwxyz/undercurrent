import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import Link from "next/link";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { token } = await searchParams;

  if (!token) {
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
          <div
            className="rounded-3xl border p-8"
            style={{
              background: "rgba(20,27,45,0.6)",
              borderColor: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(24px)",
            }}
          >
            <h2 className="font-display text-[1.4rem] font-light text-text-primary">
              Invalid link
            </h2>
            <p className="mt-3 text-[0.88rem] text-text-secondary">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block text-[0.82rem] text-cool-1 hover:text-cool-2 transition-colors"
            >
              Request a new one
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
        <h1 className="font-display text-[2.4rem] font-light tracking-wide">
          <em
            className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
            style={{ fontStyle: "italic" }}
          >
            swells
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
            Reset password
          </h2>
          <p className="mt-1 text-[0.82rem] text-text-secondary">
            enter your new password
          </p>

          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
