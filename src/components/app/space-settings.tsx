"use client";

import { useState, useTransition, useEffect } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useEscapeKey } from "@/lib/use-escape-key";
import {
  updateSpaceAction,
  inviteToSpaceAction,
  updateMemberRoleAction,
  removeMemberAction,
  deleteSpaceAction,
  updateEmailDigestPreferenceAction,
} from "@/app/(app)/actions";
import type { SpaceRole } from "@/lib/types";
import { canManageMembers, canDeleteSpace } from "@/lib/permissions";

interface SpaceSettingsProps {
  spaceId: string;
  userRole: SpaceRole;
  emailDigestEnabled: boolean;
  onClose: () => void;
}

const ROLES: SpaceRole[] = ["admin", "facilitator", "observer", "viewer"];

export function SpaceSettings({ spaceId, userRole, emailDigestEnabled, onClose }: SpaceSettingsProps) {
  const [tab, setTab] = useState<"info" | "members" | "invitations" | "billing">("info");
  const [isPending, startTransition] = useTransition();

  // Space info form
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [infoLoaded, setInfoLoaded] = useState(false);

  // Notification preference (self-scoped, not tied to the info-tab save button)
  const [digestEnabled, setDigestEnabled] = useState(emailDigestEnabled);
  const [digestPending, startDigestTransition] = useTransition();

  function handleToggleDigest() {
    if (digestPending) return; // guard fast double-clicks, not just the disabled prop
    const next = !digestEnabled;
    setDigestEnabled(next); // optimistic
    startDigestTransition(async () => {
      const formData = new FormData();
      formData.set("spaceId", spaceId);
      formData.set("enabled", String(next));
      try {
        await updateEmailDigestPreferenceAction(formData);
      } catch {
        setDigestEnabled(!next); // revert on failure
      }
    });
  }

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceRole>("observer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Members + invitations data (fetched client-side)
  const [members, setMembers] = useState<{ userId: string; name: string; email: string; role: string }[]>([]);
  const [invitations, setInvitations] = useState<{ id: string; email: string; role: string; expired: boolean; accepted: boolean }[]>([]);

  // Billing data
  const [billingData, setBillingData] = useState<{
    tier: string;
    status: string;
    observationCount: number;
    observationLimit: number;
    userLimit: number;
    trialEndsAt: string | null;
    hasStripeCustomer: boolean;
  } | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const trapRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  // Fetch space data on mount
  useEffect(() => {
    fetch(`/api/space/${spaceId}/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.name) {
          setSpaceName(data.name);
          setSpaceDescription(data.description ?? "");
          setInfoLoaded(true);
        }
        if (data.members) setMembers(data.members);
        if (data.invitations) setInvitations(data.invitations);
      })
      .catch((err) => console.error("Failed to load space settings:", err));
  }, [spaceId]);

  function handleSaveInfo() {
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    formData.set("name", spaceName);
    formData.set("description", spaceDescription);
    startTransition(async () => {
      await updateSpaceAction(formData);
    });
  }

  function handleInvite() {
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    formData.set("email", inviteEmail);
    formData.set("role", inviteRole);
    startTransition(async () => {
      const result = await inviteToSpaceAction(formData);
      if (result?.link) {
        setInviteLink(result.link);
        setInviteEmail("");
      }
    });
  }

  function handleRoleChange(userId: string, newRole: string) {
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    formData.set("userId", userId);
    formData.set("role", newRole);
    startTransition(async () => {
      await updateMemberRoleAction(formData);
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m));
    });
  }

  function handleRemoveMember(userId: string) {
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    formData.set("userId", userId);
    startTransition(async () => {
      await removeMemberAction(formData);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    });
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    startTransition(async () => {
      await deleteSpaceAction(formData);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-settings-title"
        className="relative w-[90%] max-w-[600px] max-h-[85vh] overflow-y-auto rounded-3xl border bg-surface p-6 md:p-8"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-lg text-text-muted hover:text-text-secondary"
          aria-label="Close"
        >
          ✕
        </button>

        <h3 id="space-settings-title" className="font-display text-2xl font-light text-text-primary mb-6">
          Space settings
        </h3>

        {/* Tabs */}
        <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["info", "members", "invitations", ...(userRole === "owner" ? ["billing" as const] : [])] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`tabpanel-${t}`}
              onClick={() => {
                setTab(t);
                if (t === "billing" && !billingLoaded) {
                  fetch(`/api/space/${spaceId}/billing`)
                    .then((r) => r.json())
                    .then((data) => { setBillingData(data); setBillingLoaded(true); })
                    .catch(() => setBillingLoaded(true));
                }
              }}
              className={`flex-1 rounded-lg py-2 text-[0.8rem] transition-all ${
                tab === t
                  ? "bg-white/[0.08] text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t === "info" ? "Info" : t === "members" ? "Members" : t === "invitations" ? "Invitations" : "Billing"}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === "info" && (
          <div id="tabpanel-info" role="tabpanel" aria-labelledby="tab-info" className="space-y-4">
            <div>
              <label htmlFor="space-name" className="mb-1 block text-[0.75rem] text-text-muted">Name</label>
              <input
                id="space-name"
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                disabled={!infoLoaded}
              />
            </div>
            <div>
              <label htmlFor="space-description" className="mb-1 block text-[0.75rem] text-text-muted">Description</label>
              <textarea
                id="space-description"
                value={spaceDescription}
                onChange={(e) => setSpaceDescription(e.target.value)}
                className="w-full resize-y rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                style={{ minHeight: "80px" }}
                disabled={!infoLoaded}
              />
            </div>
            <button
              onClick={handleSaveInfo}
              disabled={isPending || !infoLoaded}
              className="rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>

            {/* Notifications — self-scoped, applies to this member only */}
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <h4 className="mb-2 text-[0.85rem] font-medium text-text-primary">Notifications</h4>
              <label className="flex cursor-pointer items-start gap-2.5 text-[0.82rem] text-text-secondary">
                <input
                  type="checkbox"
                  checked={digestEnabled}
                  onChange={handleToggleDigest}
                  disabled={digestPending}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.03] accent-cool-1"
                />
                <span>
                  Weekly email digest
                  <span className="block text-[0.75rem] text-text-muted">
                    Dominant themes, attention shifts, and a reflection prompt — sent Mondays.
                  </span>
                </span>
              </label>
            </div>

            {/* Danger zone */}
            {canDeleteSpace(userRole) && (
              <div className="mt-8 rounded-xl border border-warm-1/20 p-4">
                <h4 className="text-[0.85rem] font-medium text-warm-1">Danger zone</h4>
                <p className="mt-1 text-[0.78rem] text-text-muted">
                  Permanently delete this space and all its data.
                </p>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="mt-3 rounded-xl border border-warm-1/30 px-4 py-2 text-[0.8rem] text-warm-1 transition-colors hover:bg-warm-1/10"
                  >
                    Delete space
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="rounded-xl bg-warm-1 px-4 py-2 text-[0.8rem] font-medium text-deep transition-colors hover:bg-warm-1/90 disabled:opacity-50"
                    >
                      {isPending ? "Deleting..." : "Confirm delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="text-[0.8rem] text-text-muted hover:text-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === "members" && (
          <div id="tabpanel-members" role="tabpanel" aria-labelledby="tab-members" className="space-y-2">
            {members.length === 0 ? (
              <div className="py-8 text-center text-[0.85rem] text-text-muted">Loading members...</div>
            ) : (
              members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-xl border border-white/[0.04] p-3"
                >
                  <div>
                    <div className="text-[0.85rem] text-text-primary">{member.name ?? "Anonymous"}</div>
                    <div className="text-[0.72rem] text-text-muted">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageMembers(userRole) && member.role !== "owner" ? (
                      <>
                        <label htmlFor={`role-${member.userId}`} className="sr-only">Role for {member.name ?? member.email}</label>
                        <select
                          id={`role-${member.userId}`}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[0.75rem] text-text-primary outline-none"
                          disabled={isPending}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={isPending}
                          className="text-[0.72rem] text-warm-1 hover:text-warm-1/80 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[0.72rem] text-text-muted">
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Invitations tab */}
        {tab === "invitations" && canManageMembers(userRole) && (
          <div id="tabpanel-invitations" role="tabpanel" aria-labelledby="tab-invitations" className="space-y-4">
            {/* Invite form */}
            <div className="flex flex-wrap gap-2">
              <label htmlFor="invite-email" className="sr-only">Email address</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 min-w-[200px] rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30 placeholder:text-text-muted"
              />
              <label htmlFor="invite-role" className="sr-only">Role</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as SpaceRole)}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[0.82rem] text-text-primary outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={handleInvite}
                disabled={isPending || !inviteEmail}
                className="rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-50"
              >
                {isPending ? "Inviting..." : "Invite"}
              </button>
            </div>

            {/* Invite link display */}
            {inviteLink && (
              <div className="rounded-xl border border-cool-1/20 bg-cool-1/5 p-3">
                <div className="mb-1 text-[0.75rem] font-medium text-cool-1">Invitation link created</div>
                <div className="flex items-center gap-2">
                  <label htmlFor="invite-link" className="sr-only">Invitation link</label>
                  <input
                    id="invite-link"
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[0.75rem] text-text-secondary outline-none"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="rounded-lg bg-cool-1/15 px-3 py-1.5 text-[0.75rem] text-cool-1 hover:bg-cool-1/25"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-1 text-[0.68rem] text-text-muted">Expires in 7 days</div>
              </div>
            )}

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[0.78rem] font-medium text-text-secondary">Pending invitations</h4>
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between rounded-xl border border-white/[0.04] p-3 ${
                      inv.accepted || inv.expired ? "opacity-50" : ""
                    }`}
                  >
                    <div>
                      <div className="text-[0.82rem] text-text-primary">{inv.email}</div>
                      <div className="text-[0.68rem] text-text-muted">
                        {inv.accepted ? "Accepted" : inv.expired ? "Expired" : "Pending"} · {inv.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Billing tab */}
        {tab === "billing" && userRole === "owner" && (
          <div id="tabpanel-billing" role="tabpanel" aria-labelledby="tab-billing" className="space-y-4">
            {!billingLoaded ? (
              <div className="py-8 text-center text-[0.85rem] text-text-muted">Loading billing...</div>
            ) : !billingData?.tier ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] p-4 text-center">
                  <p className="text-[0.85rem] text-text-secondary">No subscription yet</p>
                  <p className="mt-1 text-[0.75rem] text-text-muted">
                    Choose a plan to unlock observation limits and collaboration features.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["individual", "team"] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await fetch("/api/stripe/checkout", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tier }),
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        });
                      }}
                      disabled={isPending}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center transition-all hover:border-cool-1/30 hover:bg-white/[0.04] disabled:opacity-50"
                    >
                      <div className="text-[0.8rem] font-medium text-text-primary capitalize">{tier}</div>
                      <div className="mt-1 text-[0.68rem] text-text-muted">30-day trial</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[0.85rem] font-medium text-text-primary capitalize">{billingData.tier} plan</div>
                      <div className="mt-0.5 text-[0.72rem] text-text-muted capitalize">{billingData.status}</div>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-medium ${
                      billingData.status === "active" || billingData.status === "trialing"
                        ? "bg-cool-1/12 text-cool-1"
                        : "bg-warm-1/12 text-warm-1"
                    }`}>
                      {billingData.status === "trialing" ? "Trial" : billingData.status}
                    </span>
                  </div>
                  {billingData.trialEndsAt && billingData.status === "trialing" && (
                    <div className="mt-2 text-[0.72rem] text-text-muted">
                      Trial ends {new Date(billingData.trialEndsAt).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>

                {/* Usage */}
                <div className="rounded-xl border border-white/[0.06] p-4">
                  <div className="text-[0.75rem] font-medium text-text-secondary mb-2">Usage this month</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.8rem] text-text-primary">Observations</span>
                    <span className="text-[0.8rem] text-text-secondary">
                      {billingData.observationCount} / {billingData.observationLimit}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-cool-1/60 transition-all"
                      style={{ width: `${Math.min(100, (billingData.observationCount / billingData.observationLimit) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[0.8rem] text-text-primary">Members</span>
                    <span className="text-[0.8rem] text-text-secondary">
                      {members.length} / {billingData.userLimit}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {billingData.hasStripeCustomer ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          const res = await fetch("/api/stripe/portal", { method: "POST" });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        });
                      }}
                      disabled={isPending}
                      className="rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-50"
                    >
                      {isPending ? "Loading..." : "Manage billing"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-[0.75rem] text-text-muted">
                      You&apos;re on a trial — switch plans below or continue to checkout when you&apos;re ready.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["individual", "team"] as const).map((tier) => (
                        <button
                          key={tier}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await fetch("/api/stripe/checkout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ tier }),
                              });
                              const data = await res.json();
                              if (data.url) window.location.href = data.url;
                            });
                          }}
                          disabled={isPending || tier === billingData.tier}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center transition-all hover:border-cool-1/30 hover:bg-white/[0.04] disabled:opacity-50"
                        >
                          <div className="text-[0.8rem] font-medium text-text-primary capitalize">{tier}</div>
                          <div className="mt-1 text-[0.68rem] text-text-muted">
                            {tier === billingData.tier ? "Current plan" : "Switch"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
