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

  const [space, signalRows, sentimentRows, userSpaces] = await Promise.all([
    getSpaceById(spaceId),
    getSignalsForSpace(spaceId),
    getObservationsWithSentiment(spaceId),
    getSpacesForUser(session.user.id),
  ]);

  if (!space) redirect("/dashboard");

  const scene = buildSwellsSemanticScene({
    spaceId,
    signals: signalRows.map(toSignalView),
    sentiment: toSentimentViewData(sentimentRows),
  });

  return (
    <TabletSwellsSurface
      projection={projectSwellsSurface(scene, "tablet")}
      spaceName={space.name}
      spaces={userSpaces.map(({ id, name }) => ({ id, name }))}
    />
  );
}
