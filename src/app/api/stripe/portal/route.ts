import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionForUser } from "@/lib/db/queries";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const subscription = await getSubscriptionForUser(session.user.id);
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
