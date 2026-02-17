import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getUserDefaultSpace,
  getObservationsForSpace,
  getSignalsForSpace,
  getConstellationNodesForSpace,
  getSpaceStats,
  hasDemoData,
  getObservationsWithSentiment,
} from "@/lib/db/queries";
import {
  toObservationView,
  toSignalView,
  toConstellationNodeView,
  toSentimentViewData,
} from "@/lib/db/transforms";
import { AppShell } from "@/components/app/app-shell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const spaceId = await getUserDefaultSpace(session.user.id);
  if (!spaceId) redirect("/onboarding");

  const [obsRows, sigRows, nodeRows, stats, hasDemo, sentimentRows] =
    await Promise.all([
      getObservationsForSpace(spaceId),
      getSignalsForSpace(spaceId),
      getConstellationNodesForSpace(spaceId),
      getSpaceStats(spaceId),
      hasDemoData(spaceId),
      getObservationsWithSentiment(spaceId),
    ]);

  return (
    <AppShell
      observations={obsRows.map(toObservationView)}
      signals={sigRows.map(toSignalView)}
      nodes={nodeRows.map(toConstellationNodeView)}
      stats={stats}
      hasDemo={hasDemo}
      spaceId={spaceId}
      sentimentData={toSentimentViewData(sentimentRows)}
    />
  );
}
