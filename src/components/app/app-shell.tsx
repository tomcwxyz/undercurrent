"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { resizeImageIfNeeded } from "@/lib/resize-image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { RiverView } from "@/components/app/river-view";
import { DemoBanner } from "@/components/app/demo-banner";
import { SubscriptionGate } from "@/components/app/subscription-gate";
import { MediaUploadPreview } from "@/components/app/media-upload-preview";
import type { PendingMedia } from "@/components/app/media-upload-preview";

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
const CollectView = dynamic(() => import("@/components/app/collect-view").then((m) => m.CollectView), { loading: ViewSkeleton });
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
  SignalObservationMaps,
  ReflectionView,
  NotificationView,
  TimelineEvent,
  SpaceView,
  SpaceRole,
  CollectionView,
  LandscapeTerrainLayer,
} from "@/lib/types";
import { canEditSpace, canCreateObservation } from "@/lib/permissions";

type View = "river" | "constellation" | "landscape" | "heat" | "reflect" | "timeline" | "collect";

const VIEW_LABELS: Record<View, string> = {
  river: "River",
  constellation: "Constellation",
  landscape: "Signals",
  heat: "Sentiment",
  reflect: "Reflect",
  timeline: "Timeline",
  collect: "Collect",
};

interface AppShellProps {
  observations: ObservationView[];
  pendingObservations?: ObservationView[];
  terrain?: LandscapeTerrainLayer[];
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
  signalObservationMaps?: SignalObservationMaps;
  userEmail?: string | null;
  isSuperAdmin?: boolean;
  collections?: CollectionView[];
  emailDigestEnabled?: boolean;
}

export function AppShell({
  observations,
  pendingObservations,
  terrain,
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
  signalObservationMaps,
  userEmail,
  isSuperAdmin: isSuperAdminProp,
  collections,
  emailDigestEnabled = true,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<View>("river");
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightedObservationId, setHighlightedObservationId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeSpaceMenu = useCallback(() => setSpaceMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  useEscapeKey(notifOpen, closeNotif);
  useEscapeKey(moreOpen, closeMore);
  useEscapeKey(spaceMenuOpen, closeSpaceMenu);
  useEscapeKey(userMenuOpen, closeUserMenu);

  // While any observation is still mid-pipeline, poll for fresh server data
  // so the "Analyzing…" chip clears without a manual refresh. Bounded so a
  // stuck job (or a signal that quietly never re-processes) can't poll forever.
  // Keyed on the actual set of pending IDs (not just a boolean) so the budget
  // restarts when a new submission arrives while an older one is still pending.
  const router = useRouter();
  const unprocessedKey = observations
    .filter((o) => !o.aiProcessedAt)
    .map((o) => o.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!unprocessedKey) return;
    let elapsedMs = 0;
    const interval = setInterval(() => {
      elapsedMs += 5000;
      if (elapsedMs > 60000) {
        clearInterval(interval);
        return;
      }
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [unprocessedKey, router]);

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
            <em
              className="font-display text-[1.6rem] font-light tracking-wide bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
              style={{ fontStyle: "italic" }}
            >
              swells
            </em>

            {/* Space selector */}
            {spaces && spaces.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setSpaceMenuOpen(!spaceMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={spaceMenuOpen}
                  aria-controls="space-menu"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                >
                  <span className="max-w-[120px] truncate">
                    {spaces.find((s) => s.id === currentSpaceId)?.name ?? "Space"}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {spaceMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSpaceMenuOpen(false)} />
                    <div
                      id="space-menu"
                      role="menu"
                      className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-white/[0.06] p-1.5 backdrop-blur-2xl"
                      style={{ background: "rgba(15,20,35,0.95)" }}
                    >
                      {spaces.map((space) => (
                        <Link
                          key={space.id}
                          href={`/dashboard/${space.id}`}
                          role="menuitem"
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${
                            space.id === currentSpaceId ? "text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          <span className="flex-1 truncate">{space.name}</span>
                          {space.id === currentSpaceId && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cool-1" aria-hidden="true" />
                          )}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-white/[0.06]" />
                      <Link
                        href="/dashboard/new"
                        role="menuitem"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8rem] text-cool-1 transition-colors hover:bg-white/[0.06]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
            aria-label="Views"
            className="hidden rounded-3xl p-1 md:flex"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {(Object.keys(VIEW_LABELS) as View[]).map((view) => (
              <button
                key={view}
                onClick={() => switchView(view)}
                aria-current={activeView === view ? "page" : undefined}
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
                aria-haspopup="true"
                aria-expanded={notifOpen}
                aria-controls="notification-dropdown"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
                aria-controls="user-menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-white/[0.06] p-1.5 backdrop-blur-2xl"
                    style={{ background: "rgba(15,20,35,0.95)" }}
                  >
                    {isSuperAdminProp && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08A2.5 2.5 0 0 0 12 19.5a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 12 4.5" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Admin
                      </Link>
                    )}
                    <Link
                      href="/referral"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="22" y1="11" x2="16" y2="11" />
                      </svg>
                      Referrals
                    </Link>
                    <div className="my-1 border-t border-white/[0.06]" />
                    <button
                      role="menuitem"
                      onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/sign-in" }); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

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

        {/* Subscription Gate — shown when access is denied */}
        {subscriptionStatus && !subscriptionStatus.allowed && (
          <SubscriptionGate reason={subscriptionStatus.reason} />
        )}

        {/* Live region for view changes */}
        <div className="sr-only" aria-live="polite">
          {VIEW_LABELS[activeView]} view
        </div>

        {/* Main Content */}
        <main className="flex flex-1 flex-col pb-16 md:pb-0">
          {activeView === "river" && (
            <RiverView
              observations={observations}
              stats={stats}
              highlightedId={highlightedObservationId}
              signalsByObservation={signalObservationMaps?.byObservation}
              collections={collections}
              onOpenObservationModal={() => setModalOpen(true)}
            />
          )}
          {activeView === "constellation" && (
            <ConstellationView
              nodes={nodes}
              observations={observations}
              signalObservationMaps={signalObservationMaps}
              collections={collections}
              onNavigateToObservation={(id) => {
                setHighlightedObservationId(id);
                setActiveView("river");
              }}
            />
          )}
          {activeView === "landscape" && (
            <LandscapeView
              signals={signals}
              observations={observations}
              signalObservationMaps={signalObservationMaps}
              collections={collections}
              terrain={terrain}
              onNavigateToObservation={(id) => {
                setHighlightedObservationId(id);
                setActiveView("river");
              }}
            />
          )}
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
            <TimelineView timelineEvents={timelineEvents} collections={collections} />
          )}
          {activeView === "collect" && (
            <CollectView
              collections={collections ?? []}
              observations={observations}
              pendingObservations={pendingObservations ?? []}
              spaceId={spaceId}
              canManage={canEditSpace(userRole)}
            />
          )}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav
          aria-label="Views"
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </MobileTab>

          {/* Centre FAB — observe button */}
          {canCreateObservation(userRole) && subscriptionStatus?.allowed !== false && (
            <button
              onClick={() => setModalOpen(true)}
              aria-label="Add observation"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-1 shadow-[0_0_24px_rgba(255,107,74,0.4)] transition-transform active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </MobileTab>

          <MobileTab
            label="Sentiment"
            active={activeView === "heat"}
            onClick={() => switchView("heat")}
          >
            {/* Thermometer/flame icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
          </MobileTab>

          {/* More overflow for Reflect + Timeline */}
          <div className="relative">
            <MobileTab
              label="More"
              active={activeView === "reflect" || activeView === "timeline" || activeView === "collect"}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </MobileTab>

            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-50 mb-2 min-w-[140px] rounded-xl border border-white/[0.06] p-1.5 backdrop-blur-2xl"
                  style={{ background: "rgba(15,20,35,0.95)" }}
                >
                  <button
                    role="menuitem"
                    onClick={() => { switchView("reflect"); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${activeView === "reflect" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Reflect
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { switchView("timeline"); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${activeView === "timeline" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20V10" />
                      <path d="M18 20V4" />
                      <path d="M6 20v-4" />
                    </svg>
                    Timeline
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { switchView("collect"); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8rem] transition-colors hover:bg-white/[0.06] ${activeView === "collect" ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <rect x="7" y="7" width="10" height="10" rx="1" />
                    </svg>
                    Collect
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
            emailDigestEnabled={emailDigestEnabled}
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
      id="notification-dropdown"
      role="menu"
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
        notification.read ? "opacity-75" : ""
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
      aria-current={active ? "page" : undefined}
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

async function uploadMediaItem(
  file: File | Blob,
  fileName: string,
  contentType: string,
  spaceId: string,
  onProgress: (pct: number) => void
): Promise<{ key: string; publicUrl: string; mediaType: "image" | "voice" | "file" }> {
  const res = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType, spaceId, fileSize: file.size }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to get upload URL");
  }
  const { uploadUrl, key, publicUrl, mediaType } = await res.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.send(file);
  });

  onProgress(100);
  return { key, publicUrl, mediaType };
}

function ObservationModal({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nudge] = useState(() => NUDGES[Math.floor(Math.random() * NUDGES.length)]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const trapRef = useFocusTrap(true);
  const voice = useVoiceRecorder();

  // Discard recording when modal closes
  useEffect(() => {
    return () => voice.discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEscapeKey(true, onClose);

  const addFiles = useCallback((files: FileList | File[], type: "image" | "voice" | "file") => {
    const newItems: PendingMedia[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      type,
      file,
      objectUrl: URL.createObjectURL(file),
      fileName: file.name,
      mimeType: file.type,
      uploadProgress: 0,
      uploaded: false,
    }));
    setPendingMedia((prev) => [...prev, ...newItems]);
  }, []);

  const removeMedia = useCallback((id: string) => {
    setPendingMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.objectUrl);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(async (formData: FormData) => {
    setSubmitError(null);
    const hasText = (formData.get("text") as string)?.trim().length > 0;
    const hasMedia = pendingMedia.length > 0;
    if (!hasText && !hasMedia) return;

    // Upload all pending media first
    const mediaRefs: { key: string; url: string; type: string; fileName: string; mimeType: string; fileSize: number }[] = [];

    if (pendingMedia.length > 0) {
      setIsUploading(true);
      try {
        for (const item of pendingMedia) {
          // item.file is File | Blob generally, but "image" items only ever
          // come from a file input (never the voice recorder), so it's a File.
          const uploadFile =
            item.type === "image" ? await resizeImageIfNeeded(item.file as File) : item.file;
          const result = await uploadMediaItem(
            uploadFile,
            item.fileName,
            uploadFile.type,
            spaceId,
            (pct) => {
              setPendingMedia((prev) =>
                prev.map((m) => (m.id === item.id ? { ...m, uploadProgress: pct } : m))
              );
            }
          );
          setPendingMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, uploaded: true, storageKey: result.key, publicUrl: result.publicUrl }
                : m
            )
          );
          mediaRefs.push({
            key: result.key,
            url: result.publicUrl,
            type: result.mediaType,
            fileName: item.fileName,
            mimeType: uploadFile.type,
            fileSize: uploadFile.size,
          });
        }
      } catch {
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (mediaRefs.length > 0) {
      formData.set("mediaKeys", JSON.stringify(mediaRefs));
    }

    try {
      await createObservation(formData);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      return;
    }

    // Clean up object URLs
    for (const item of pendingMedia) {
      URL.revokeObjectURL(item.objectUrl);
    }

    onClose();
  }, [pendingMedia, spaceId, onClose]);

  const busy = isPending || isUploading;
  const hasImages = pendingMedia.some((m) => m.type === "image");

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
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="observation-modal-title"
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

        <h3 id="observation-modal-title" className="font-display text-3xl font-light text-text-primary">
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
            startTransition(() => handleSubmit(formData));
          }}
        >
          <input type="hidden" name="spaceId" value={spaceId} />
          <label htmlFor="observation-text" className="sr-only">Your observation</label>
          <textarea
            id="observation-text"
            name="text"
            className="mt-4 w-full resize-y rounded-[14px] border bg-white/[0.04] p-4 font-body text-[0.92rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              minHeight: "120px",
            }}
            placeholder={
              hasImages
                ? "Add context, or just submit the image\u2026"
                : pendingMedia.some((m) => m.type === "voice")
                ? "Add context, or just submit the recording\u2026"
                : "I noticed that..."
            }
            autoFocus
          />

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files, "file");
              e.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,audio/x-m4a,.mp3,.wav,.m4a,.ogg"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files, "voice");
              e.target.value = "";
            }}
          />

          <MediaUploadPreview items={pendingMedia} onRemove={removeMedia} />

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-[0.82rem] text-text-secondary transition-all hover:bg-white/[0.04] hover:text-text-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Photo
            </button>
            <button
              type="button"
              onClick={async () => {
                if (voice.status === "idle") {
                  await voice.start();
                } else {
                  const blob = await voice.stop();
                  if (blob && blob.size > 0) {
                    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "mp4" : "ogg";
                    const file = new File([blob], `voice-${Date.now()}.${ext}`, {
                      type: blob.type,
                    });
                    addFiles([file], "voice");
                  }
                }
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.82rem] transition-all ${
                voice.status === "recording"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : "border-white/8 text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
              }`}
            >
              {voice.status === "recording" ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  {String(Math.floor(voice.elapsed / 60)).padStart(2, "0")}:{String(voice.elapsed % 60).padStart(2, "0")}
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                  Voice
                </>
              )}
            </button>
            {voice.error && (
              <span className="text-[0.75rem] text-red-400">{voice.error}</span>
            )}
            {voice.status === "idle" && (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2.5 text-[0.78rem] text-text-muted transition-all hover:bg-white/[0.04] hover:text-text-secondary"
                aria-label="Upload audio file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Upload
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-[0.82rem] text-text-secondary transition-all hover:bg-white/[0.04] hover:text-text-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              </svg>
              File
            </button>

            <button
              type="submit"
              disabled={busy}
              className="ml-auto rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 px-7 py-2.5 text-[0.85rem] font-medium text-deep transition-all hover:shadow-[0_4px_24px_rgba(78,205,196,0.3)] hover:-translate-y-px disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : isPending ? "Flowing..." : "Flow it in"}
            </button>
          </div>
          {submitError && (
            <p className="mt-3 text-[0.78rem] text-red-400">{submitError}</p>
          )}
        </form>
      </div>
    </div>
  );
}
