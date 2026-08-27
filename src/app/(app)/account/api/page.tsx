import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ApiKeysPanel } from "./api-keys-panel";

export default async function ApiAccessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <main className="min-h-svh px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <Link
          href="/dashboard"
          className="text-[0.8rem] text-text-muted transition-colors hover:text-text-primary"
        >
          ← Back to Swells
        </Link>

        <div className="mt-8">
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-cool-1">
            Integrations
          </p>
          <h1 className="mt-2 font-display text-4xl font-light text-text-primary">
            API access
          </h1>
          <p className="mt-3 max-w-[680px] text-[0.9rem] leading-relaxed text-text-secondary">
            Connect Swells to your own tools and agents. API keys act as you:
            they can only reach spaces you already belong to and still respect
            your role in each space.
          </p>
        </div>

        <ApiKeysPanel />
      </div>
    </main>
  );
}
