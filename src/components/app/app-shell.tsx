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

          {/* Observe Button (desktop only — mobile uses FAB in bottom bar) */}
          <button
            onClick={() => setModalOpen(true)}
            className="hidden items-center gap-2.5 rounded-3xl border border-warm-1/30 bg-warm-1/8 px-5 py-2.5 font-body text-[0.85rem] font-medium tracking-wide text-warm-1 transition-all hover:border-warm-1/50 hover:bg-warm-1/15 hover:shadow-[0_0_30px_rgba(255,107,74,0.15)] md:flex"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warm-1" />
            I noticed something
          </button>
        </header>

        {/* Demo Banner */}
        {hasDemo && <DemoBanner spaceId={spaceId} />}

        {/* Main Content */}
        <main className="flex flex-1 flex-col pb-16 md:pb-0">
          {activeView === "river" && (
            <RiverView observations={observations} stats={stats} />
          )}
          {activeView === "constellation" && (
            <ConstellationView nodes={nodes} />
          )}
          {activeView === "landscape" && <LandscapeView signals={signals} />}
          {activeView === "heat" && <SentimentView />}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t px-2 py-1.5 backdrop-blur-2xl md:hidden"
          style={{
            background: "rgba(10,14,26,0.85)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <MobileTab
            label="River"
            active={activeView === "river"}
            onClick={() => setActiveView("river")}
          >
            {/* Water/wave icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            </svg>
          </MobileTab>

          <MobileTab
            label="Stars"
            active={activeView === "constellation"}
            onClick={() => setActiveView("constellation")}
          >
            {/* Stars icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </MobileTab>

          {/* Centre FAB — observe button */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-1 shadow-[0_0_24px_rgba(255,107,74,0.4)] transition-transform active:scale-95"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <MobileTab
            label="Signals"
            active={activeView === "landscape"}
            onClick={() => setActiveView("landscape")}
          >
            {/* Mountain/landscape icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </MobileTab>

          <MobileTab
            label="Sentiment"
            active={activeView === "heat"}
            onClick={() => setActiveView("heat")}
          >
            {/* Thermometer/flame icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
          </MobileTab>
        </nav>

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

function MobileTab({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[0.6rem] tracking-wide transition-colors ${
        active ? "text-text-primary" : "text-text-muted"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
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
        className="relative w-[90%] max-w-[560px] rounded-3xl border bg-surface p-6 md:p-10"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-lg text-text-muted hover:text-text-secondary md:-top-10 md:right-0"
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

          <div className="mt-5 flex flex-wrap gap-3">
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
