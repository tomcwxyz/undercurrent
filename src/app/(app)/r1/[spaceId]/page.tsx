import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMemberRole,
  getObservationsWithSentiment,
  getSignalsForSpace,
  getSpaceById,
  getSpacesForUser,
} from "@/lib/db/queries";
import { toSentimentViewData, toSignalView } from "@/lib/db/transforms";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import {
  buildSwellsSemanticScene,
  projectSwellsSurface,
} from "@/lib/surfaces/project";
import { R1SwellsSurface } from "@/components/app/r1/r1-swells-surface";

export default async function R1SpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { spaceId } = await params;
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role) {
    redirect("/dashboard");
  }

  const [space, signalRows, sentimentRows, userSpaces] = await Promise.all([
    getSpaceById(spaceId),
    getSignalsForSpace(spaceId),
    getObservationsWithSentiment(spaceId),
    getSpacesForUser(session.user.id),
  ]);

  if (!space) {
    redirect("/dashboard");
  }

  const scene = buildSwellsSemanticScene({
    spaceId,
    signals: signalRows.map(toSignalView),
    sentiment: toSentimentViewData(sentimentRows),
  });

  return (
    <R1SwellsSurface
      projection={projectSwellsSurface(scene, "r1")}
      spaceName={space.name}
      spaces={userSpaces.map(({ id, name }) => ({ id, name }))}
      canCapture={canCreateObservation(role as SpaceRole)}
    />
  );
}
