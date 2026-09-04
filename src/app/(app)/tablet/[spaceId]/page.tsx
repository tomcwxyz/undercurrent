import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMediaForObservations,
  getMemberRole,
  getObservationsForSpace,
  getObservationsWithSentiment,
  getSignalObservationsForSpace,
  getSignalSnapshotsForSpace,
  getSignalsForSpace,
  getSpaceById,
  getSpacesForUser,
} from "@/lib/db/queries";
import {
  toObservationView,
  toSentimentViewData,
  toSignalObservationMaps,
  toSignalView,
} from "@/lib/db/transforms";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import {
  buildSwellsSemanticScene,
  projectSwellsSurface,
} from "@/lib/surfaces/project";
import { TabletSwellsSurface } from "@/components/app/tablet/tablet-swells-surface";

export default async function TabletSpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { spaceId } = await params;
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role) redirect("/dashboard");

  const [
    space,
    signalRows,
    sentimentRows,
    userSpaces,
    observationRows,
    signalObservationRows,
    snapshotRows,
  ] = await Promise.all([
    getSpaceById(spaceId),
    getSignalsForSpace(spaceId),
    getObservationsWithSentiment(spaceId),
    getSpacesForUser(session.user.id),
    getObservationsForSpace(spaceId),
    getSignalObservationsForSpace(spaceId),
    getSignalSnapshotsForSpace(spaceId),
  ]);

  if (!space) redirect("/dashboard");

  const mediaRows = await getMediaForObservations(observationRows.map((row) => row.id));
  const observations = observationRows
    .filter((row) => row.moderationStatus !== "rejected")
    .map((row) =>
      toObservationView(
        row,
        mediaRows.filter((media) => media.observationId === row.id),
      ),
    );
  const signals = signalRows.map(toSignalView);
  const signalTitleMap = Object.fromEntries(signals.map((signal) => [signal.id, signal.title]));
  const signalMaps = toSignalObservationMaps(signalObservationRows, signalTitleMap);

  const scene = buildSwellsSemanticScene({
    spaceId,
    signals,
    sentiment: toSentimentViewData(sentimentRows),
  });

  return (
    <TabletSwellsSurface
      projection={projectSwellsSurface(scene, "tablet")}
      spaceName={space.name}
      spaces={userSpaces.map(({ id, name }) => ({ id, name }))}
      observations={observations}
      signalObservationMap={signalMaps.bySignal}
      signalHistory={snapshotRows.map((snapshot) => ({
        id: snapshot.id,
        signalId: snapshot.signalId,
        snapshotAt: snapshot.snapshotAt.toISOString(),
        strength: snapshot.strength,
        direction: snapshot.direction,
      }))}
      canCapture={canCreateObservation(role as SpaceRole)}
    />
  );
}
