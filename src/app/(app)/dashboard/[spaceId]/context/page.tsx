import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contextPrompts } from "@/lib/db/context-schema";
import { getMemberRole } from "@/lib/db/queries";
import {
  dismissContextPrompt,
  keepContextPrompt,
} from "./actions";

export default async function ContextReviewPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { spaceId } = await params;

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role) redirect("/dashboard");

  const prompts = await db
    .select()
    .from(contextPrompts)
    .where(
      and(
        eq(contextPrompts.userId, session.user.id),
        eq(contextPrompts.spaceId, spaceId),
        eq(contextPrompts.status, "pending"),
      ),
    )
    .orderBy(desc(contextPrompts.createdAt));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/${spaceId}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to Swells
        </Link>
        <p className="mt-8 text-sm font-medium uppercase tracking-[0.12em] text-neutral-500">
          From your context
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Anything worth noticing?
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-neutral-600">
          These are private prompts from connected activity. They are not
          observations and do not influence any signal unless you choose to
          write down what you noticed.
        </p>
      </div>

      {prompts.length === 0 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="font-medium text-neutral-900">Nothing waiting</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Swells has no connected-context prompts for you in this space.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {prompts.map((row) => {
            const prompt = row.interpretation;
            const occurred = new Date(prompt.occurredAt);
            return (
              <article
                key={row.id}
                className="rounded-2xl border border-neutral-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                      {Number.isNaN(occurred.getTime())
                        ? "Recent meeting"
                        : occurred.toLocaleDateString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                    </p>
                    <h2 className="mt-2 text-xl font-medium text-neutral-950">
                      {prompt.title}
                    </h2>
                  </div>
                  {prompt.sourceUrl && (
                    <a
                      href={prompt.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-neutral-500 hover:text-neutral-900"
                    >
                      Open calendar event ↗
                    </a>
                  )}
                </div>

                <p className="mt-5 leading-relaxed text-neutral-800">
                  {prompt.prompt}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  Context: {prompt.contextSummary}
                </p>

                <form action={keepContextPrompt} className="mt-5 space-y-3">
                  <input type="hidden" name="promptId" value={row.id} />
                  <input type="hidden" name="spaceId" value={spaceId} />
                  <label
                    htmlFor={`context-${row.id}`}
                    className="block text-sm font-medium text-neutral-800"
                  >
                    What did you notice?
                  </label>
                  <textarea
                    id={`context-${row.id}`}
                    name="text"
                    required
                    maxLength={5000}
                    rows={4}
                    placeholder="Write the observation in your own words."
                    className="w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 outline-none focus:border-neutral-500"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Keep as an observation
                  </button>
                </form>

                <form action={dismissContextPrompt} className="mt-3">
                  <input type="hidden" name="promptId" value={row.id} />
                  <input type="hidden" name="spaceId" value={spaceId} />
                  <button
                    type="submit"
                    className="text-sm text-neutral-500 hover:text-neutral-900"
                  >
                    Nothing worth keeping
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
