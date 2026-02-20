"use client";

import { useState } from "react";

export function ReferralCard({
  referralCode,
  referralLink,
  referralCount,
  discountPct,
}: {
  referralCode: string;
  referralLink: string;
  referralCount: number;
  discountPct: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.06] bg-surface p-8">
      <h2 className="font-display text-2xl font-light text-text-primary">
        Refer a friend
      </h2>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-text-secondary">
        Share your referral link. When someone subscribes, you both benefit —
        you get 10% off per referral, up to 30% forever.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <code className="flex-1 truncate text-[0.8rem] text-cool-1">
          {referralLink}
        </code>
        <button
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-cool-1/10 px-3 py-1.5 text-[0.75rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/20"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="font-display text-2xl font-light text-text-primary">
            {referralCount}
          </div>
          <div className="mt-1 text-[0.75rem] text-text-muted">
            Referrals
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="font-display text-2xl font-light text-cool-1">
            {discountPct}%
          </div>
          <div className="mt-1 text-[0.75rem] text-text-muted">
            Your discount
          </div>
        </div>
      </div>

      <p className="mt-4 text-[0.75rem] text-text-muted">
        Code: <span className="font-mono text-text-secondary">{referralCode}</span>
      </p>
    </div>
  );
}
