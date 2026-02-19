import { NextResponse } from "next/server";
import { getStripe, getTierConfig, type Tier, type Stripe } from "@/lib/stripe";
import {
  createSubscription,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  getSubscriptionByStripeCustomerId,
} from "@/lib/db/queries";

function getPeriodEnd(sub: Stripe.Subscription): Date {
  const item = sub.items.data[0];
  return item ? new Date(item.current_period_end * 1000) : new Date();
}

function getSubIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details?.subscription) return null;
  return typeof details.subscription === "string"
    ? details.subscription
    : details.subscription.id;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tier = (session.metadata?.tier ?? "individual") as Tier;

      if (!userId || !session.customer || !session.subscription) break;

      const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const config = getTierConfig(tier);

      const existing = await getSubscriptionByStripeCustomerId(customerId);
      if (!existing) {
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

        await createSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          tier,
          status: stripeSub.status === "trialing" ? "trialing" : "active",
          trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          currentPeriodEnd: getPeriodEnd(stripeSub),
          userLimit: config.userLimit,
        });
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      const subId = getSubIdFromInvoice(invoice);
      if (!subId) break;

      const sub = await getSubscriptionByStripeId(subId);
      if (sub) {
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        await updateSubscriptionStatus(subId, {
          status: "active",
          currentPeriodEnd: getPeriodEnd(stripeSub),
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subId = getSubIdFromInvoice(invoice);
      if (!subId) break;

      await updateSubscriptionStatus(subId, { status: "past_due" });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const status = subscription.status as "trialing" | "active" | "past_due" | "canceled" | "unpaid";
      const item = subscription.items.data[0];
      const periodEnd = item ? new Date(item.current_period_end * 1000) : undefined;

      await updateSubscriptionStatus(subscription.id, {
        status,
        currentPeriodEnd: periodEnd,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await updateSubscriptionStatus(subscription.id, { status: "canceled" });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
