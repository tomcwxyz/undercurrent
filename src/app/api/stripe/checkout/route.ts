import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe, getTierConfig, TIER_LABELS, type Tier } from "@/lib/stripe";
import { getSubscriptionForUser } from "@/lib/db/queries";
import { getBaseUrl } from "@/lib/env";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  if (!(body.tier in TIER_LABELS)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  const tier = body.tier as Tier;

  const existing = await getSubscriptionForUser(session.user.id);
  if (existing?.stripeSubscriptionId && existing.status !== "canceled") {
    return NextResponse.json({ error: "Already subscribed" }, { status: 400 });
  }

  const config = getTierConfig(tier);
  const baseUrl = getBaseUrl();
  const stripe = getStripe();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: existing?.stripeCustomerId ? undefined : session.user.email,
    customer: existing?.stripeCustomerId || undefined,
    line_items: [{ price: config.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    payment_method_collection: "if_required",
    subscription_data: {
      trial_period_days: existing?.status === "trialing" ? undefined : 30,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: {
        userId: session.user.id,
        tier,
      },
    },
    metadata: {
      userId: session.user.id,
      tier,
    },
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=canceled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
