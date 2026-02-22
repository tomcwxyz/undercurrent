import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getSubscriptionForUser,
  getReferralCountForSubscription,
} from "@/lib/db/queries";
import { getBaseUrl } from "@/lib/env";
import { ReferralCard } from "./referral-card";

export default async function ReferralPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const subscription = await getSubscriptionForUser(session.user.id);
  if (!subscription?.referralCode) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <p className="text-text-secondary">No referral code available yet.</p>
      </div>
    );
  }

  const referralCount = await getReferralCountForSubscription(subscription.id);
  const baseUrl = getBaseUrl();
  const referralLink = `${baseUrl}/sign-in?ref=${subscription.referralCode}`;

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <ReferralCard
        referralCode={subscription.referralCode}
        referralLink={referralLink}
        referralCount={referralCount}
        discountPct={subscription.referralDiscountPct ?? 0}
      />
    </div>
  );
}
