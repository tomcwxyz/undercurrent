import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemberRole, getSubscriptionForUser, getObservationCountThisMonth } from "@/lib/db/queries";
import { getTierConfig } from "@/lib/stripe";
import type { SpaceRole } from "@/lib/types";
import { canDeleteSpace } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { spaceId } = await params;
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canDeleteSpace(role as SpaceRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const subscription = await getSubscriptionForUser(session.user.id);
  if (!subscription) {
    return NextResponse.json({ tier: null });
  }

  const config = getTierConfig(subscription.tier);
  const observationCount = await getObservationCountThisMonth(spaceId);

  return NextResponse.json({
    tier: subscription.tier,
    status: subscription.status,
    observationCount,
    observationLimit: config.observationLimit,
    userLimit: subscription.userLimit,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
  });
}
