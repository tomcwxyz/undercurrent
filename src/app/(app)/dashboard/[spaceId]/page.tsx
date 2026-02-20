import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getMemberRole,
  getObservationsForSpace,
  getSignalsForSpace,
  getSignalObservationsForSpace,
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
} from "@/lib/db/queries";
import { checkSubscriptionAccess } from "@/lib/stripe";
import { isSuperAdmin } from "@/lib/account";
import {
  toObservationView,
  toSignalView,
  toConstellationNodeView,
  toSignalObservationMaps,
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

  // Verify membership (super admin can access any space)
  let role = await getMemberRole(session.user.id, spaceId);
  if (!role && isSuperAdmin(session.user.email)) {
    role = "admin"; // Grant admin-level access for super admin
  }
  if (!role) redirect("/dashboard");

  const [obsRows, sigRows, nodeRows, stats, hasDemo, sentimentRows, reflectionData, notifRows, unreadCount, snapshotRows, userSpaces, junctionRows] =
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
      getSignalObservationsForSpace(spaceId),
    ]);

  // Build signal title map for timeline
  const signalTitleMap: Record<string, string> = {};
  for (const s of sigRows) {
    signalTitleMap[s.id] = s.title;
  }

  const signalObservationMaps = toSignalObservationMaps(junctionRows, signalTitleMap);

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
  const subscriptionStatus = await checkSubscriptionAccess(session.user.id, session.user.email);

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
      signalObservationMaps={signalObservationMaps}
      userEmail={session.user.email}
      isSuperAdmin={isSuperAdmin(session.user.email)}
    />
  );
}
