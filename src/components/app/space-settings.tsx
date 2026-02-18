"use client";

import { useState, useTransition, useEffect } from "react";
import {
  updateSpaceAction,
  inviteToSpaceAction,
  updateMemberRoleAction,
  removeMemberAction,
  deleteSpaceAction,
} from "@/app/(app)/actions";
import type { SpaceRole } from "@/lib/types";
import { canManageMembers, canDeleteSpace } from "@/lib/permissions";

interface SpaceSettingsProps {
  spaceId: string;
  userRole: SpaceRole;
  onClose: () => void;
}

const ROLES: SpaceRole[] = ["admin", "facilitator", "observer", "viewer"];

export function SpaceSettings({ spaceId, userRole, onClose }: SpaceSettingsProps) {
  const [tab, setTab] = useState<"info" | "members" | "invitations">("info");
  const [isPending, startTransition] = useTransition();

  // Space info form
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [infoLoaded, setInfoLoaded] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceRole>("observer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Members + invitations data (fetched client-side)
  const [members, setMembers] = useState<{ userId: string; name: string; email: string; role: string }[]>([]);
  const [invitations, setInvitations] = useState<{ id: string; email: string; role: string; expired: boolean; accepted: boolean }[]>([]);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
      .catch(() => {});
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

        <h3 className="font-display text-2xl font-light text-text-primary mb-6">
          Space settings
        </h3>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["info", "members", "invitations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-[0.8rem] transition-all ${
                tab === t
                  ? "bg-white/[0.08] text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t === "info" ? "Info" : t === "members" ? "Members" : "Invitations"}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === "info" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[0.75rem] text-text-muted">Name</label>
              <input
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                disabled={!infoLoaded}
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.75rem] text-text-muted">Description</label>
              <textarea
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
          <div className="space-y-2">
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
                        <select
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
          <div className="space-y-4">
            {/* Invite form */}
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 min-w-[200px] rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30 placeholder:text-text-muted"
              />
              <select
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
                  <input
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
      </div>
    </div>
  );
}
