import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import {
  getUserDefaultSpace,
  createSubscription,
  getSubscriptionByReferralCode,
  createReferral,
} from "@/lib/db/queries";
import { seedDemoData } from "@/lib/db/seed";
import { hasFreeAccess } from "@/lib/account";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  // If user already has a space, skip onboarding
  const existingSpace = await getUserDefaultSpace(session.user.id);
  if (existingSpace) redirect(`/dashboard/${existingSpace}`);

  // Seed demo data and redirect
  await seedDemoData(session.user.id);

  // Create trial subscription (skip for free-access accounts)
  if (!hasFreeAccess(session.user.email)) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    await createSubscription({
      userId: session.user.id,
      tier: "individual",
      status: "trialing",
      trialEndsAt: trialEnd,
      currentPeriodEnd: trialEnd,
      userLimit: 1,
      referralCode: randomBytes(4).toString("hex"), // 8 hex chars
    });

    // Handle referral code if present
    const { ref } = await searchParams;
    if (ref) {
      const referrerSub = await getSubscriptionByReferralCode(ref);
      if (referrerSub && referrerSub.userId !== session.user.id) {
        await createReferral(referrerSub.id, session.user.id);
      }
    }
  }

  // After seeding, get the new space
  const spaceId = await getUserDefaultSpace(session.user.id);
  redirect(spaceId ? `/dashboard/${spaceId}` : "/dashboard");
}
