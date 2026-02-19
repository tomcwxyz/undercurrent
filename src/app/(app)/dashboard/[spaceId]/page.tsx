import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getMemberRole,
  getObservationsForSpace,
  getSignalsForSpace,
  getConstellationNodesForSpace,
  getSpaceStats,
  hasDemoData,
  getObservationsWithSentiment,
  getReflectionsForSpace,
  getNotificationsForUser,
  getUnreadNotificationCount,
  getSignalSnapshotsForSpace,
  getSpacesForUser,
  getSpaceMemberCount,
  getSubscriptionForUser,
} from "@/lib/db/queries";
import { checkSubscriptionAccess } from "@/lib/stripe";
import {
  toObservationView,
  toSignalView,
  toConstellationNodeView,
  toSentimentViewData,
  toReflectionViewData,
  toNotificationView,
  toTimelineEvents,
} from "@/lib/db/transforms";
import { AppShell } from "@/components/app/app-shell";
import type { SpaceView, SpaceRole } from "@/lib/types";

export default async function SpaceDashboardPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { spaceId } = await params;

  // Verify membership
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role) redirect("/dashboard");

  const [obsRows, sigRows, nodeRows, stats, hasDemo, sentimentRows, reflectionData, notifRows, unreadCount, snapshotRows, userSpaces] =
    await Promise.all([
      getObservationsForSpace(spaceId),
      getSignalsForSpace(spaceId),
      getConstellationNodesForSpace(spaceId),
      getSpaceStats(spaceId),
      hasDemoData(spaceId),
      getObservationsWithSentiment(spaceId),
      getReflectionsForSpace(spaceId),
      getNotificationsForUser(session.user.id, spaceId),
      getUnreadNotificationCount(session.user.id, spaceId),
      getSignalSnapshotsForSpace(spaceId),
      getSpacesForUser(session.user.id),
    ]);

  // Build signal title map for timeline
  const signalTitleMap: Record<string, string> = {};
  for (const s of sigRows) {
    signalTitleMap[s.id] = s.title;
  }

  const timelineEvents = toTimelineEvents(
    obsRows,
    snapshotRows,
    reflectionData.reflections,
    signalTitleMap,
  );

  // Build spaces list with member counts
  const spacesWithCounts = await Promise.all(
    userSpaces.map(async (s): Promise<SpaceView> => ({
      id: s.id,
      name: s.name,
      description: s.description,
      memberCount: await getSpaceMemberCount(s.id),
      role: s.role as SpaceRole,
    }))
  );

  // Compute subscription status
  const subscription = await getSubscriptionForUser(session.user.id);
  let subscriptionStatus: { allowed: boolean; reason: string; trialDaysLeft?: number } | undefined;
  if (subscription) {
    const access = checkSubscriptionAccess(subscription);
    subscriptionStatus = { ...access };
    if (subscription.trialEndsAt) {
      const msLeft = subscription.trialEndsAt.getTime() - new Date().getTime();
      subscriptionStatus.trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
    }
  }

  return (
    <AppShell
      observations={obsRows.map(toObservationView)}
      signals={sigRows.map(toSignalView)}
      nodes={nodeRows.map(toConstellationNodeView)}
      stats={stats}
      hasDemo={hasDemo}
      spaceId={spaceId}
      sentimentData={toSentimentViewData(sentimentRows)}
      reflections={toReflectionViewData(
        reflectionData.reflections,
        reflectionData.responses,
        reflectionData.signalTitleMap
      )}
      notifications={notifRows.map(toNotificationView)}
      unreadNotificationCount={unreadCount}
      timelineEvents={timelineEvents}
      spaces={spacesWithCounts}
      currentSpaceId={spaceId}
      userRole={role as SpaceRole}
      subscriptionStatus={subscriptionStatus}
    />
  );
}
