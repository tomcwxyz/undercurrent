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
  getMemberCountsForSpaces,
  getMediaForObservations,
  getCollectionsForSpace,
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
  toCollectionView,
  toLandscapeTerrain,
} from "@/lib/db/transforms";
import { getBaseUrl } from "@/lib/env";
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

  // Fetch media for all observations
  const obsIds = obsRows.map((o) => o.id);
  const mediaRows = await getMediaForObservations(obsIds);
  const mediaByObservation = new Map<string, typeof mediaRows>();
  for (const m of mediaRows) {
    const existing = mediaByObservation.get(m.observationId) ?? [];
    existing.push(m);
    mediaByObservation.set(m.observationId, existing);
  }

  // Split observations by moderation status. Pending submissions (from a
  // moderated collection) only surface in the Collect tab's review queue;
  // rejected ones are hidden everywhere. Everything else flows to all views.
  const approvedObsRows = obsRows.filter(
    (o) => (o.moderationStatus ?? "approved") === "approved"
  );
  const pendingObsRows = obsRows.filter((o) => o.moderationStatus === "pending");

  // Build signal title map for timeline
  const signalTitleMap: Record<string, string> = {};
  for (const s of sigRows) {
    signalTitleMap[s.id] = s.title;
  }

  const signalObservationMaps = toSignalObservationMaps(junctionRows, signalTitleMap);

  const timelineEvents = toTimelineEvents(
    approvedObsRows,
    snapshotRows,
    reflectionData.reflections,
    signalTitleMap,
  );

  // Build spaces list with member counts — one grouped query, not one per space.
  const memberCounts = await getMemberCountsForSpaces(userSpaces.map((s) => s.id));
  const spacesWithCounts: SpaceView[] = userSpaces.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    memberCount: memberCounts[s.id] ?? 0,
    role: s.role as SpaceRole,
  }));

  // Compute subscription status
  const subscriptionStatus = await checkSubscriptionAccess(session.user.id, session.user.email);

  // Fetch collections for this space (used by the Collect tab)
  const collectionsRaw = await getCollectionsForSpace(spaceId);
  const baseUrl = getBaseUrl();
  const collections = collectionsRaw.map((c) => toCollectionView(c, baseUrl));

  return (
    <AppShell
      observations={approvedObsRows.map((row) => toObservationView(row, mediaByObservation.get(row.id)))}
      pendingObservations={pendingObsRows.map((row) => toObservationView(row, mediaByObservation.get(row.id)))}
      terrain={toLandscapeTerrain(approvedObsRows)}
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
      collections={collections}
    />
  );
}
