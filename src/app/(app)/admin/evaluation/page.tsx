import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/account";
import { db } from "@/lib/db";
import {
  surfaceCaptureReviews,
  surfaceFeedback,
  surfaceInteractionEvents,
} from "@/lib/db/surface-schema";
import { signals, spaces, users } from "@/lib/db/schema";

function pct(numerator: number, denominator: number) {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function EvaluationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!isSuperAdmin(session.user.email)) redirect("/dashboard");

  const [feedbackRows, captureRows, interactionRows] = await Promise.all([
    db
      .select({
        id: surfaceFeedback.id,
        createdAt: surfaceFeedback.createdAt,
        kind: surfaceFeedback.kind,
        judgement: surfaceFeedback.judgement,
        question: surfaceFeedback.question,
        answer: surfaceFeedback.answer,
        evidenceIds: surfaceFeedback.evidenceIds,
        signalId: surfaceFeedback.signalId,
        signalTitle: signals.title,
        spaceName: spaces.name,
        userEmail: users.email,
      })
      .from(surfaceFeedback)
      .leftJoin(signals, eq(signals.id, surfaceFeedback.signalId))
      .innerJoin(spaces, eq(spaces.id, surfaceFeedback.spaceId))
      .innerJoin(users, eq(users.id, surfaceFeedback.userId))
      .orderBy(desc(surfaceFeedback.createdAt))
      .limit(250),
    db
      .select({
        status: surfaceCaptureReviews.status,
        decision: surfaceCaptureReviews.decision,
        createdAt: surfaceCaptureReviews.createdAt,
      })
      .from(surfaceCaptureReviews)
      .orderBy(desc(surfaceCaptureReviews.createdAt))
      .limit(250),
    db
      .select({
        sessionId: surfaceInteractionEvents.sessionId,
        event: surfaceInteractionEvents.event,
        lens: surfaceInteractionEvents.lens,
        createdAt: surfaceInteractionEvents.createdAt,
      })
      .from(surfaceInteractionEvents)
      .orderBy(desc(surfaceInteractionEvents.createdAt))
      .limit(1000),
  ]);

  const ask = feedbackRows.filter((row) => row.kind === "ask_answer");
  const signal = feedbackRows.filter((row) => row.kind === "signal_interpretation");
  const askUseful = ask.filter((row) => row.judgement === "useful").length;
  const signalFits = signal.filter((row) => row.judgement === "fits").length;
  const negative = feedbackRows
    .filter((row) =>
      ["not_useful", "does_not_fit"].includes(row.judgement),
    )
    .slice(0, 40);

  const reviewedCaptures = captureRows.filter((row) => row.status === "reviewed");
  const separatedCaptures = reviewedCaptures.filter(
    (row) => row.decision === "keep_separate",
  );
  const r1Sessions = new Set(interactionRows.map((row) => row.sessionId)).size;
  const lensCounts = interactionRows
    .filter((row) => row.event === "lens_view" && row.lens)
    .reduce<Record<string, number>>((counts, row) => {
      const lens = row.lens!;
      counts[lens] = (counts[lens] ?? 0) + 1;
      return counts;
    }, {});
  const lensSummary = Object.entries(lensCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lens, count]) => `${lens} ${count}`)
    .join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
      <div className="flex items-start justify-between gap-6">
        <div>
          <a
            href="/admin"
            className="text-[0.75rem] uppercase tracking-[0.14em] text-text-muted hover:text-text-secondary"
          >
            ← Admin
          </a>
          <h1 className="mt-3 font-display text-3xl font-light text-text-primary">
            Evaluation
          </h1>
          <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-text-secondary">
            Explicit human judgement from Swells surfaces. This is evaluation data:
            it does not silently change signals or model behaviour.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-right">
          <div className="text-[1.5rem] font-light text-text-primary">
            {feedbackRows.length + reviewedCaptures.length}
          </div>
          <div className="text-[0.68rem] uppercase tracking-[0.13em] text-text-muted">
            recent judgements
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Metric
          label="Ask usefulness"
          value={pct(askUseful, ask.length)}
          detail={ask.length ? `${askUseful} useful · ${ask.length - askUseful} missed` : "No Ask feedback yet"}
        />
        <Metric
          label="Signal fit"
          value={pct(signalFits, signal.length)}
          detail={signal.length ? `${signalFits} fits · ${signal.length - signalFits} off` : "No signal-fit feedback yet"}
        />
        <Metric
          label="Negative cases"
          value={String(negative.length)}
          detail="Recent cases worth inspecting"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Metric
          label="R1 sessions"
          value={String(r1Sessions)}
          detail={interactionRows.length ? `${interactionRows.length} recent interactions` : "No R1 interaction data yet"}
        />
        <Metric
          label="Capture reviews"
          value={String(reviewedCaptures.length)}
          detail={captureRows.some((row) => row.status === "pending") ? "Includes notices still awaiting judgement" : "No pending R1 notice reviews"}
        />
        <Metric
          label="Kept separate"
          value={pct(separatedCaptures.length, reviewedCaptures.length)}
          detail={reviewedCaptures.length ? `${separatedCaptures.length} of ${reviewedCaptures.length} reviewed notices` : "No reviewed notices yet"}
        />
      </div>

      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="text-[0.68rem] uppercase tracking-[0.13em] text-text-muted">
          R1 lens use
        </div>
        <div className="mt-2 text-[0.82rem] leading-relaxed text-text-secondary">
          {lensSummary || "No lens views recorded yet."}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl font-light text-text-primary">
          Where Swells missed
        </h2>
        <p className="mt-1 text-[0.78rem] text-text-muted">
          Most recent “Missed it” and “Something’s off” judgements.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
          {negative.length ? (
            <div className="divide-y divide-white/[0.05]">
              {negative.map((row) => (
                <article key={row.id} className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.11em] text-text-muted">
                    <span>{row.judgement === "not_useful" ? "Ask missed it" : "Signal feels off"}</span>
                    <span>•</span>
                    <span>{row.spaceName}</span>
                    {row.signalTitle ? (
                      <>
                        <span>•</span>
                        <span className="text-cool-1">{row.signalTitle}</span>
                      </>
                    ) : null}
                    <span className="ml-auto normal-case tracking-normal">
                      {row.createdAt.toLocaleString("en-GB")}
                    </span>
                  </div>

                  {row.question ? (
                    <div className="mt-3 text-[0.82rem] text-text-secondary">
                      <span className="text-text-muted">Question:</span> {row.question}
                    </div>
                  ) : null}

                  {row.answer ? (
                    <div className="mt-2 rounded-lg bg-white/[0.025] px-3 py-2 text-[0.82rem] leading-relaxed text-text-secondary">
                      {row.answer}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-4 text-[0.7rem] text-text-muted">
                    <span>{row.userEmail ?? "Unknown user"}</span>
                    {row.evidenceIds.length ? (
                      <span>{row.evidenceIds.length} cited observation{row.evidenceIds.length === 1 ? "" : "s"}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-[0.82rem] text-text-muted">
              No negative feedback yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="text-[0.68rem] uppercase tracking-[0.13em] text-text-muted">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-light text-text-primary">
        {value}
      </div>
      <div className="mt-1 text-[0.75rem] text-text-secondary">{detail}</div>
    </div>
  );
}
