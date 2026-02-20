"use client";

interface SubscriptionGateProps {
  reason: string;
}

export function SubscriptionGate({ reason }: SubscriptionGateProps) {
  const messages: Record<string, { title: string; body: string; cta: string }> = {
    no_subscription: {
      title: "Start your plan",
      body: "Choose a plan to start observing and sensing what's emerging.",
      cta: "Choose a plan",
    },
    trial_expired: {
      title: "Your trial has ended",
      body: "Upgrade to continue using Swells. Your data is safe and waiting.",
      cta: "Choose a plan",
    },
    payment_failed: {
      title: "Payment issue",
      body: "We couldn't process your payment. Please update your billing details to continue.",
      cta: "Manage billing",
    },
    inactive: {
      title: "Subscription inactive",
      body: "Reactivate your subscription to pick up where you left off.",
      cta: "Manage billing",
    },
  };

  const msg = messages[reason] ?? messages.inactive;
  const useCheckout = reason === "no_subscription" || reason === "trial_expired";

  async function handleClick() {
    if (useCheckout) {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "individual" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } else {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-[420px] rounded-2xl border border-white/[0.06] bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-1/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-1">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M3.44 18h17.12a1 1 0 0 0 .86-1.5L13.36 3a1.5 1.5 0 0 0-2.72 0L2.58 16.5A1 1 0 0 0 3.44 18z" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-light text-text-primary">{msg.title}</h3>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-text-secondary">{msg.body}</p>
        <button
          onClick={handleClick}
          className="mt-6 rounded-xl bg-warm-1 px-6 py-2.5 text-[0.85rem] font-medium text-deep transition-all hover:shadow-[0_0_24px_rgba(255,107,74,0.3)]"
        >
          {msg.cta}
        </button>
      </div>
    </div>
  );
}
