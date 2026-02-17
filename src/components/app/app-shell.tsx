"use client";

import { useState, useRef, useTransition } from "react";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { RiverView } from "@/components/app/river-view";
import { ConstellationView } from "@/components/app/constellation-view";
import { LandscapeView } from "@/components/app/landscape-view";
import { SentimentView } from "@/components/app/sentiment-view";
import { DemoBanner } from "@/components/app/demo-banner";
import { createObservation } from "@/app/(app)/actions";
import type {
  ObservationView,
  SignalView,
  ConstellationNodeView,
  SpaceStats,
} from "@/lib/types";

type View = "river" | "constellation" | "landscape" | "heat";

const VIEW_LABELS: Record<View, string> = {
  river: "River",
  constellation: "Constellation",
  landscape: "Signals",
  heat: "Sentiment",
};

interface AppShellProps {
  observations: ObservationView[];
  signals: SignalView[];
  nodes: ConstellationNodeView[];
  stats: SpaceStats;
  hasDemo: boolean;
  spaceId: string;
}

export function AppShell({
  observations,
  signals,
  nodes,
  stats,
  hasDemo,
  spaceId,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<View>("river");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <HeroCanvas />

      <div className="relative z-10 flex min-h-svh flex-col">
        {/* Top Bar */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-2xl md:px-8"
          style={{
            background: "rgba(10,14,26,0.5)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="font-display text-[1.6rem] font-light tracking-wide text-text-primary">
            under
            <em
              className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
              style={{ fontStyle: "italic" }}
            >
              current
            </em>
          </div>

          {/* View Navigation */}
          <nav
            className="hidden rounded-3xl p-1 md:flex"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {(Object.keys(VIEW_LABELS) as View[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`rounded-2xl px-5 py-2 font-body text-[0.82rem] tracking-wide transition-all ${
                  activeView === view
                    ? "text-text-primary shadow-md"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                style={
                  activeView === view
                    ? {
                        background: "rgba(255,255,255,0.08)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                      }
                    : undefined
                }
              >
                {VIEW_LABELS[view]}
              </button>
            ))}
          </nav>

          {/* Observe Button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2.5 rounded-3xl border border-warm-1/30 bg-warm-1/8 px-5 py-2.5 font-body text-[0.85rem] font-medium tracking-wide text-warm-1 transition-all hover:border-warm-1/50 hover:bg-warm-1/15 hover:shadow-[0_0_30px_rgba(255,107,74,0.15)]"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warm-1" />
            I noticed something
          </button>
        </header>

        {/* Demo Banner */}
        {hasDemo && <DemoBanner spaceId={spaceId} />}

        {/* Main Content */}
        <main className="flex flex-1 flex-col">
          {activeView === "river" && (
            <RiverView observations={observations} stats={stats} />
          )}
          {activeView === "constellation" && (
            <ConstellationView nodes={nodes} />
          )}
          {activeView === "landscape" && <LandscapeView signals={signals} />}
          {activeView === "heat" && <SentimentView />}
        </main>

        {/* Observation Modal */}
        {modalOpen && (
          <ObservationModal
            spaceId={spaceId}
            onClose={() => setModalOpen(false)}
          />
        )}
      </div>
    </>
  );
}

function ObservationModal({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{
        background: "rgba(10,14,26,0.8)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-[90%] max-w-[560px] rounded-3xl border bg-surface p-10"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-lg text-text-muted hover:text-text-secondary"
          aria-label="Close"
        >
          ✕
        </button>

        <h3 className="font-display text-3xl font-light text-text-primary">
          What did you notice?
        </h3>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-text-secondary">
          Don&apos;t worry about what it means. Just describe what you observed
          — a feeling, a conversation, a moment, a pattern.
        </p>

        <form
          ref={formRef}
          action={(formData) => {
            startTransition(async () => {
              await createObservation(formData);
              onClose();
            });
          }}
        >
          <input type="hidden" name="spaceId" value={spaceId} />
          <textarea
            name="text"
            className="mt-7 w-full resize-y rounded-[14px] border bg-white/[0.04] p-4 font-body text-[0.92rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              minHeight: "120px",
            }}
            placeholder="I noticed that..."
            autoFocus
            required
          />

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-[0.82rem] text-text-secondary transition-all hover:bg-white/[0.04] hover:text-text-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Photo
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-[0.82rem] text-text-secondary transition-all hover:bg-white/[0.04] hover:text-text-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              Voice
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-[0.82rem] text-text-secondary transition-all hover:bg-white/[0.04] hover:text-text-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              </svg>
              File
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="ml-auto rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 px-7 py-2.5 text-[0.85rem] font-medium text-deep transition-all hover:shadow-[0_4px_24px_rgba(78,205,196,0.3)] hover:-translate-y-px disabled:opacity-50"
            >
              {isPending ? "Flowing..." : "Flow it in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
