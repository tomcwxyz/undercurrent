"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { RiverView } from "@/components/app/river-view";
import { DemoBanner } from "@/components/app/demo-banner";

function ViewSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="h-6 w-6 animate-pulse rounded-full bg-cool-1/20" />
    </div>
  );
}

const ConstellationView = dynamic(() => import("@/components/app/constellation-view").then((m) => m.ConstellationView), { loading: ViewSkeleton });
const LandscapeView = dynamic(() => import("@/components/app/landscape-view").then((m) => m.LandscapeView), { loading: ViewSkeleton });
const SentimentView = dynamic(() => import("@/components/app/sentiment-view").then((m) => m.SentimentView), { loading: ViewSkeleton });
const ReflectionViewComponent = dynamic(() => import("@/components/app/reflection-view").then((m) => m.ReflectionViewComponent), { loading: ViewSkeleton });
const TimelineView = dynamic(() => import("@/components/app/timeline-view").then((m) => m.TimelineView), { loading: ViewSkeleton });
const SpaceSettings = dynamic(() => import("@/components/app/space-settings").then((m) => m.SpaceSettings));
import {
  createObservation,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/(app)/actions";
import type {
  ObservationView,
  SignalView,
  ConstellationNodeView,
  SpaceStats,
  SentimentViewData,
  ReflectionView,
  NotificationView,
  TimelineEvent,
  SpaceView,
  SpaceRole,
} from "@/lib/types";
import { canEditSpace, canCreateObservation } from "@/lib/permissions";

type View = "river" | "constellation" | "landscape" | "heat" | "reflect" | "timeline";

const VIEW_LABELS: Record<View, string> = {
  river: "River",
  constellation: "Constellation",
  landscape: "Signals",
  heat: "Sentiment",
  reflect: "Reflect",
  timeline: "Timeline",
};

interface AppShellProps {
  observations: ObservationView[];
  signals: SignalView[];
  nodes: ConstellationNodeView[];
  stats: SpaceStats;
  hasDemo: boolean;
  spaceId: string;
  sentimentData: SentimentViewData;
  reflections: ReflectionView[];
  notifications: NotificationView[];
  unreadNotificationCount: number;
  timelineEvents: TimelineEvent[];
  spaces?: SpaceView[];
  currentSpaceId?: string;
  userRole?: SpaceRole;
  subscriptionStatus?: { allowed: boolean; reason: string; trialDaysLeft?: number };
}

export function AppShell({
  observations,
  signals,
  nodes,
  stats,
  hasDemo,
  spaceId,
  sentimentData,
  reflections,
  notifications,
  unreadNotificationCount,
  timelineEvents,
  spaces,
  currentSpaceId,
  userRole = "observer",
  subscriptionStatus,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<View>("river");
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightedObservationId, setHighlightedObservationId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function switchView(view: View) {
    setActiveView(view);
    setHighlightedObservationId(null);
  }

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
          <div className="flex items-center gap-3">
            <div className="font-display text-[1.6rem] font-light tracking-wide text-text-primary">
              under
              <em
                className="bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
                style={{ fontStyle: "italic" }}
              >
                current
              </em>
            </div>

            {/* Space selector */}
            {spaces && spaces.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setSpaceMenuOpen(!spaceMenuOpen)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                >
                  <span className="max-w-[120px] truncate">
                    {spaces.find((s) => s.id === currentSpaceId)?.name ?? "Space"}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {spaceMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSpaceMenuOpen(false)} />
                    <div
                      className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-white/[0.06] p-1.5 backdrop-blur-2xl"
                      style={{ background: "rgba(15,20,35,0.95)" }}
                    >
                      {spaces.map((space) => (
                        <Link
                          key={space.id}
                          href={`/dashboard/${space.id}`}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${
                            space.id === currentSpaceId ? "text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          <span className="flex-1 truncate">{space.name}</span>
                          {space.id === currentSpaceId && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cool-1" />
                          )}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-white/[0.06]" />
                      <Link
                        href="/dashboard/new"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8rem] text-cool-1 transition-colors hover:bg-white/[0.06]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create new space
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* View Navigation */}
          <nav
            className="hidden rounded-3xl p-1 md:flex"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {(Object.keys(VIEW_LABELS) as View[]).map((view) => (
              <button
                key={view}
                onClick={() => switchView(view)}
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

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                aria-label="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warm-1 px-1 text-[0.6rem] font-bold text-deep">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <NotificationDropdown
                    notifications={notifications}
                    spaceId={spaceId}
                    onNavigate={(linkTo) => {
                      setNotifOpen(false);
                      if (linkTo && linkTo in VIEW_LABELS) {
                        switchView(linkTo as View);
                      }
                    }}
                  />
                </>
              )}
            </div>

            {/* Settings gear (admin+) */}
            {canEditSpace(userRole) && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                aria-label="Space settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            )}

            {/* Observe Button (desktop only — mobile uses FAB in bottom bar) */}
            {canCreateObservation(userRole) && subscriptionStatus?.allowed !== false && (
              <button
                onClick={() => setModalOpen(true)}
                className="hidden items-center gap-2.5 rounded-3xl border border-warm-1/30 bg-warm-1/8 px-5 py-2.5 font-body text-[0.85rem] font-medium tracking-wide text-warm-1 transition-all hover:border-warm-1/50 hover:bg-warm-1/15 hover:shadow-[0_0_30px_rgba(255,107,74,0.15)] md:flex"
              >
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warm-1" />
                I noticed something
              </button>
            )}
          </div>
        </header>

        {/* Demo Banner */}
        {hasDemo && <DemoBanner spaceId={spaceId} />}

        {/* Trial countdown banner */}
        {subscriptionStatus?.allowed && subscriptionStatus.trialDaysLeft != null && subscriptionStatus.trialDaysLeft <= 10 && (
          <div className="flex items-center justify-center gap-2 bg-warm-3/10 px-4 py-2 text-[0.78rem] text-warm-3">
            <span>{subscriptionStatus.trialDaysLeft} day{subscriptionStatus.trialDaysLeft !== 1 ? "s" : ""} left in your trial</span>
            <button
              onClick={async () => {
                const res = await fetch("/api/stripe/portal", { method: "POST" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="rounded-lg bg-warm-3/15 px-2.5 py-0.5 text-[0.72rem] font-medium text-warm-3 transition-colors hover:bg-warm-3/25"
            >
              Upgrade now
            </button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex flex-1 flex-col pb-16 md:pb-0">
          {activeView === "river" && (
            <RiverView observations={observations} stats={stats} highlightedId={highlightedObservationId} />
          )}
          {activeView === "constellation" && (
            <ConstellationView nodes={nodes} />
          )}
          {activeView === "landscape" && <LandscapeView signals={signals} />}
          {activeView === "heat" && (
            <SentimentView
              data={sentimentData}
              onNavigateToObservation={(id) => {
                setHighlightedObservationId(id);
                setActiveView("river");
              }}
            />
          )}
          {activeView === "reflect" && (
            <ReflectionViewComponent reflections={reflections} />
          )}
          {activeView === "timeline" && (
            <TimelineView timelineEvents={timelineEvents} />
          )}
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
            onClick={() => switchView("river")}
          >
            {/* Water/wave icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            </svg>
          </MobileTab>

          <MobileTab
            label="Stars"
            active={activeView === "constellation"}
            onClick={() => switchView("constellation")}
          >
            {/* Stars icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </MobileTab>

          {/* Centre FAB — observe button */}
          {canCreateObservation(userRole) && subscriptionStatus?.allowed !== false && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-1 shadow-[0_0_24px_rgba(255,107,74,0.4)] transition-transform active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep)" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          <MobileTab
            label="Signals"
            active={activeView === "landscape"}
            onClick={() => switchView("landscape")}
          >
            {/* Mountain/landscape icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </MobileTab>

          <MobileTab
            label="Sentiment"
            active={activeView === "heat"}
            onClick={() => switchView("heat")}
          >
            {/* Thermometer/flame icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
          </MobileTab>

          {/* More overflow for Reflect + Timeline */}
          <div className="relative">
            <MobileTab
              label="More"
              active={activeView === "reflect" || activeView === "timeline"}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </MobileTab>

            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div
                  className="absolute bottom-full right-0 z-50 mb-2 min-w-[140px] rounded-xl border border-white/[0.06] p-1.5 backdrop-blur-2xl"
                  style={{ background: "rgba(15,20,35,0.95)" }}
                >
                  <button
                    onClick={() => { switchView("reflect"); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${activeView === "reflect" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Reflect
                  </button>
                  <button
                    onClick={() => { switchView("timeline"); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${activeView === "timeline" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20V10" />
                      <path d="M18 20V4" />
                      <path d="M6 20v-4" />
                    </svg>
                    Timeline
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Observation Modal */}
        {modalOpen && (
          <ObservationModal
            spaceId={spaceId}
            onClose={() => setModalOpen(false)}
          />
        )}

        {/* Space Settings Panel */}
        {settingsOpen && currentSpaceId && (
          <SpaceSettings
            spaceId={currentSpaceId}
            userRole={userRole}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </>
  );
}

function NotificationDropdown({
  notifications,
  spaceId,
  onNavigate,
}: {
  notifications: NotificationView[];
  spaceId: string;
  onNavigate: (linkTo: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const TYPE_ICONS: Record<string, string> = {
    new_reflection: "○",
    signal_transition: "↑",
    new_observation: "◊",
  };

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-2xl border border-white/[0.06] p-2 backdrop-blur-2xl"
      style={{ background: "rgba(15,20,35,0.95)" }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[0.82rem] font-medium text-text-primary">Notifications</span>
        {notifications.some((n) => !n.read) && (
          <form
            action={(formData) => {
              startTransition(async () => {
                await markAllNotificationsReadAction(formData);
              });
            }}
          >
            <input type="hidden" name="spaceId" value={spaceId} />
            <button
              type="submit"
              disabled={isPending}
              className="text-[0.72rem] text-cool-1 transition-colors hover:text-cool-2 disabled:opacity-50"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="px-3 py-6 text-center text-[0.82rem] text-text-muted">
          No notifications yet
        </div>
      ) : (
        <div className="flex flex-col">
          {notifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              icon={TYPE_ICONS[notif.type] ?? "·"}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  icon,
  onNavigate,
}: {
  notification: NotificationView;
  icon: string;
  onNavigate: (linkTo: string | null) => void;
}) {
  const [, startTransition] = useTransition();

  function handleClick() {
    if (!notification.read) {
      const formData = new FormData();
      formData.set("notificationId", notification.id);
      startTransition(async () => {
        await markNotificationReadAction(formData);
      });
    }
    onNavigate(notification.linkTo);
  }

  return (
    <button
      onClick={handleClick}
      className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] ${
        notification.read ? "opacity-60" : ""
      }`}
    >
      <span className="mt-0.5 shrink-0 text-[0.85rem] text-cool-1">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[0.8rem] leading-snug ${notification.read ? "text-text-secondary" : "text-text-primary font-medium"}`}>
            {notification.title}
          </span>
          {!notification.read && (
            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-cool-1" />
          )}
        </div>
        {notification.body && (
          <p className="mt-0.5 text-[0.72rem] leading-relaxed text-text-muted line-clamp-2">
            {notification.body}
          </p>
        )}
        <span className="mt-0.5 text-[0.65rem] text-text-muted">{notification.time}</span>
      </div>
    </button>
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
      className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[0.6rem] tracking-wide transition-colors ${
        active ? "text-text-primary" : "text-text-muted"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

const NUDGES = [
  "What felt different today?",
  "Where did you notice energy \u2014 or absence of it?",
  "What\u2019s everyone talking about that nobody\u2019s naming?",
  "What surprised you recently?",
  "What\u2019s shifting that hasn\u2019t been acknowledged?",
  "Where did you feel friction or flow?",
  "What\u2019s the mood in the room that nobody mentions?",
  "What are people doing differently, even slightly?",
  "What question is hanging in the air?",
  "What did you notice that others might have missed?",
];

function ObservationModal({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [nudge] = useState(() => NUDGES[Math.floor(Math.random() * NUDGES.length)]);

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
        <p className="mt-3 text-[0.8rem] italic text-text-muted">
          {nudge}
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
            className="mt-4 w-full resize-y rounded-[14px] border bg-white/[0.04] p-4 font-body text-[0.92rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
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
