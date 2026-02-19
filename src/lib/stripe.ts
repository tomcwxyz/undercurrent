import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export { Stripe };

export type Tier = "individual" | "team" | "organisation";

export function getTierConfig(tier: Tier) {
  const configs: Record<Tier, { priceId: string; observationLimit: number; userLimit: number; label: string }> = {
    individual: {
      priceId: process.env.STRIPE_PRICE_INDIVIDUAL ?? "",
      observationLimit: 200,
      userLimit: 1,
      label: "Individual",
    },
    team: {
      priceId: process.env.STRIPE_PRICE_TEAM ?? "",
      observationLimit: 1000,
      userLimit: 10,
      label: "Team",
    },
    organisation: {
      priceId: process.env.STRIPE_PRICE_ORG ?? "",
      observationLimit: 5000,
      userLimit: 50,
      label: "Organisation",
    },
  };
  return configs[tier];
}

export const TIER_LABELS: Record<Tier, string> = {
  individual: "Individual",
  team: "Team",
  organisation: "Organisation",
};

export function checkSubscriptionAccess(subscription: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}): { allowed: boolean; reason: string } {
  const now = new Date();

  if (subscription.status === "active") {
    return { allowed: true, reason: "active" };
  }

  if (subscription.status === "trialing") {
    if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
      return { allowed: true, reason: "trialing" };
    }
    return { allowed: false, reason: "trial_expired" };
  }

  if (subscription.status === "past_due") {
    // Grace period: allow access for 7 days past period end
    if (subscription.currentPeriodEnd) {
      const grace = new Date(subscription.currentPeriodEnd.getTime() + 7 * 86400000);
      if (now < grace) {
        return { allowed: true, reason: "past_due_grace" };
      }
    }
    return { allowed: false, reason: "payment_failed" };
  }

  return { allowed: false, reason: "inactive" };
}
