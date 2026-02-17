"use client";

import { useState, useTransition } from "react";
import { submitReflectionResponse } from "@/app/(app)/actions";
import type { ReflectionView } from "@/lib/types";

const LOOP_LABELS = {
  single: { icon: "○", label: "What's happening", color: "text-cool-1", bg: "bg-cool-1/12" },
  double: { icon: "◑", label: "Why is this happening", color: "text-cool-2", bg: "bg-cool-2/12" },
  triple: { icon: "●", label: "How do we see the world", color: "text-cool-3", bg: "bg-cool-3/12" },
} as const;

interface ReflectionViewProps {
  reflections: ReflectionView[];
}

export function ReflectionViewComponent({ reflections }: ReflectionViewProps) {
  const active = reflections.filter((r) => r.isActive);
  const past = reflections.filter((r) => !r.isActive);

  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light text-text-primary opacity-90">
          Deepening understanding
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-[0.9rem] leading-relaxed text-text-secondary">
          Reflection prompts generated from your signals. Pause, think deeper,
          and share what you see that others might not.
        </p>
      </div>

      {reflections.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mx-auto max-w-[700px]">
          {/* Active reflections */}
          {active.length > 0 && (
            <section className="mb-10">
              <h3 className="mb-5 text-[0.78rem] uppercase tracking-[0.12em] text-text-muted">
                Active reflections
              </h3>
              <div className="flex flex-col gap-5">
                {active.map((reflection) => (
                  <ReflectionCard key={reflection.id} reflection={reflection} />
                ))}
              </div>
            </section>
          )}

          {/* Past reflections */}
          {past.length > 0 && (
            <PastReflections reflections={past} />
          )}
        </div>
      )}
    </div>
  );
}

function ReflectionCard({ reflection }: { reflection: ReflectionView }) {
  const [expanded, setExpanded] = useState(false);
  const loop = LOOP_LABELS[reflection.learningLoop];

  return (
    <div
      className="rounded-2xl border border-white/[0.04] bg-card p-6 transition-all"
      style={{
        background: "linear-gradient(135deg, rgba(20,27,45,0.8), rgba(15,20,35,0.9))",
      }}
    >
      {/* Learning loop badge + time */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[0.72rem] font-medium ${loop.bg} ${loop.color}`}>
          {loop.icon} {loop.label}
        </span>
        <span className="text-[0.7rem] text-text-muted">{reflection.createdAt}</span>
      </div>

      {/* Prompt */}
      <p className="text-[1rem] leading-relaxed text-text-primary">
        {reflection.prompt}
      </p>

      {/* Signal chips */}
      {reflection.signalTitles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {reflection.signalTitles.map((title) => (
            <span
              key={title}
              className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-0.5 text-[0.7rem] text-text-secondary"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              {title}
            </span>
          ))}
        </div>
      )}

      {/* Trigger info */}
      {reflection.triggerType && (
        <p className="mt-2 text-[0.72rem] italic text-text-muted">
          Triggered by: {reflection.triggerType}
        </p>
      )}

      {/* Responses */}
      {reflection.responses.length > 0 && (
        <div className="mt-4 border-t border-white/[0.04] pt-4">
          <div className="text-[0.72rem] uppercase tracking-[0.1em] text-text-muted mb-2">
            Responses
          </div>
          {reflection.responses.map((resp) => (
            <div key={resp.id} className="mb-2 rounded-xl bg-white/[0.03] p-3">
              <div className="text-[0.7rem] text-text-muted mb-1">
                {resp.authorName} · {resp.time}
              </div>
              <p className="text-[0.85rem] leading-relaxed text-text-secondary">
                {resp.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Response form */}
      {reflection.isActive && (
        <>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="mt-4 text-[0.82rem] text-cool-1 transition-colors hover:text-cool-2"
            >
              Share your reflection...
            </button>
          ) : (
            <ResponseForm
              reflectionId={reflection.id}
              onCancel={() => setExpanded(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ResponseForm({
  reflectionId,
  onCancel,
}: {
  reflectionId: string;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-4 border-t border-white/[0.04] pt-4"
      action={(formData) => {
        startTransition(async () => {
          await submitReflectionResponse(formData);
          onCancel();
        });
      }}
    >
      <input type="hidden" name="reflectionId" value={reflectionId} />
      <textarea
        name="text"
        className="w-full resize-y rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 font-body text-[0.88rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
        style={{ minHeight: "80px" }}
        placeholder="What comes to mind when you sit with this question?"
        autoFocus
        required
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-[0.82rem] text-text-secondary transition-colors hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-cool-2 to-cool-3 px-5 py-2 text-[0.82rem] font-medium text-deep transition-all hover:shadow-[0_4px_20px_rgba(69,183,209,0.3)] hover:-translate-y-px disabled:opacity-50"
        >
          {isPending ? "Sharing..." : "Share"}
        </button>
      </div>
    </form>
  );
}

function PastReflections({ reflections }: { reflections: ReflectionView[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-5 flex items-center gap-2 text-[0.78rem] uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text-secondary"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Past reflections ({reflections.length})
      </button>

      {expanded && (
        <div className="flex flex-col gap-4">
          {reflections.map((reflection) => {
            const loop = LOOP_LABELS[reflection.learningLoop];
            return (
              <div
                key={reflection.id}
                className="rounded-xl border border-white/[0.03] bg-card/60 p-5 opacity-80"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[0.7rem] ${loop.color}`}>
                    {loop.icon} {loop.label}
                  </span>
                  <span className="text-[0.68rem] text-text-muted">{reflection.createdAt}</span>
                </div>
                <p className="text-[0.9rem] leading-relaxed text-text-secondary">
                  {reflection.prompt}
                </p>
                {reflection.responses.length > 0 && (
                  <div className="mt-3 text-[0.72rem] text-text-muted">
                    {reflection.responses.length} response{reflection.responses.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-[440px] text-center py-16">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cool-2/8">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-cool-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </div>
      <h3 className="font-display text-xl font-light text-text-primary">
        No reflections yet
      </h3>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-text-secondary">
        As you add observations and signals emerge, the system will generate
        reflection prompts to help you think more deeply about what you&apos;re sensing.
      </p>
    </div>
  );
}
