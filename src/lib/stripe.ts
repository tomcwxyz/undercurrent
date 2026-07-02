import Stripe from "stripe";
import { hasFreeAccess } from "@/lib/account";
import { getSubscriptionForUser, getObservationCountForSubscription } from "@/lib/db/queries";

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

export interface SubscriptionAccess {
  allowed: boolean;
  reason: string;
  tier?: Tier;
  trialDaysLeft?: number;
}

/**
 * Check whether a user has access to create observations.
 * Handles free-access accounts, trials, active subs, and no-subscription state.
 */
export async function checkSubscriptionAccess(
  userId: string,
  email: string | null | undefined,
): Promise<SubscriptionAccess> {
  // Free-access accounts (super admin, demo) — full access, organisation tier
  if (hasFreeAccess(email)) {
    return { allowed: true, reason: "free_access", tier: "organisation" };
  }

  const subscription = await getSubscriptionForUser(userId);

  // No subscription at all — must subscribe
  if (!subscription) {
    return { allowed: false, reason: "no_subscription" };
  }

  const now = new Date();

  if (subscription.status === "active") {
    return { allowed: true, reason: "active", tier: subscription.tier };
  }

  if (subscription.status === "trialing") {
    if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
      const msLeft = subscription.trialEndsAt.getTime() - now.getTime();
      return {
        allowed: true,
        reason: "trialing",
        tier: subscription.tier,
        trialDaysLeft: Math.max(0, Math.ceil(msLeft / 86400000)),
      };
    }
    return { allowed: false, reason: "trial_expired", tier: subscription.tier };
  }

  if (subscription.status === "past_due") {
    if (subscription.currentPeriodEnd) {
      const grace = new Date(subscription.currentPeriodEnd.getTime() + 7 * 86400000);
      if (now < grace) {
        return { allowed: true, reason: "past_due_grace", tier: subscription.tier };
      }
    }
    return { allowed: false, reason: "payment_failed", tier: subscription.tier };
  }

  return { allowed: false, reason: "inactive", tier: subscription.tier };
}

/**
 * Checks the monthly observation limit for a user's subscription (across all
 * their spaces — the limit is per account, not per space). Free-access
 * accounts and users with no subscription yet are unrestricted here.
 * Returns the subscription too, since callers need it right after to
 * increment usage.
 */
export async function checkObservationLimit(
  userId: string,
  email: string | null | undefined
): Promise<{
  ok: boolean;
  subscription: Awaited<ReturnType<typeof getSubscriptionForUser>>;
}> {
  const subscription = await getSubscriptionForUser(userId);
  if (subscription && !hasFreeAccess(email)) {
    const config = getTierConfig(subscription.tier);
    const count = await getObservationCountForSubscription(subscription.id);
    if (count >= config.observationLimit) {
      return { ok: false, subscription };
    }
  }
  return { ok: true, subscription };
}
