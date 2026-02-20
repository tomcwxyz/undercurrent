"use client";

import { Fragment, useState, useTransition } from "react";
import {
  adminUpdateUser,
  adminDeleteUser,
  adminUpdateSpace,
  adminDeleteSpace,
} from "./actions";

// ── Types ──

interface AdminSpace {
  id: string;
  name: string;
  description: string | null;
  createdAt: string; // serialised Date
  memberCount: number;
  observationCount: number;
  lastActiveAt: string | null;
  observationCount7d: number;
  observationCount30d: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  tier: string | null;
  status: string | null;
  trialEndsAt: string | null;
  referralCode: string | null;
  referralDiscountPct: number | null;
  lastActiveAt: string | null;
  observationCount7d: number;
  observationCount30d: number;
}

interface AdminDashboardProps {
  spaces: AdminSpace[];
  users: AdminUser[];
}

// ── Activity Dot ──

function ActivityDot({ lastActiveAt }: { lastActiveAt: string | null }) {
  if (!lastActiveAt) {
    return <span className="inline-block h-2 w-2 rounded-full bg-white/20" title="No activity" />;
  }
  const ms = new Date().getTime() - new Date(lastActiveAt).getTime();
  const days = ms / 86_400_000;
  if (days < 7) {
    return <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" title="Active in past 7d" />;
  }
  if (days < 30) {
    return <span className="inline-block h-2 w-2 rounded-full bg-amber-400" title="Active in past 30d" />;
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-white/20" title="Inactive 30d+" />;
}

// ── Relative time ──

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const ms = new Date().getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ── Status Badge ──

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-text-muted">—</span>;
  const colours: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400",
    trialing: "bg-cool-1/12 text-cool-1",
    past_due: "bg-amber-500/15 text-amber-400",
    canceled: "bg-white/[0.06] text-text-muted",
    unpaid: "bg-warm-1/12 text-warm-1",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[0.7rem] font-medium ${colours[status] ?? "bg-white/[0.06] text-text-muted"}`}>
      {status}
    </span>
  );
}

// ── Trial Info ──

function TrialInfo({ trialEndsAt, status }: { trialEndsAt: string | null; status: string | null }) {
  if (!trialEndsAt) return <span className="text-text-muted">—</span>;
  const end = new Date(trialEndsAt);
  const days = Math.ceil((end.getTime() - new Date().getTime()) / 86_400_000);
  const dateStr = end.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (status !== "trialing") return <span className="text-text-muted">{dateStr}</span>;
  return (
    <span className={days <= 3 ? "text-warm-1" : "text-text-secondary"}>
      {dateStr} <span className="text-[0.68rem] text-text-muted">({days > 0 ? `${days}d left` : "expired"})</span>
    </span>
  );
}

// ── Main Component ──

export function AdminDashboard({ spaces: initialSpaces, users: initialUsers }: AdminDashboardProps) {
  const [tab, setTab] = useState<"spaces" | "users">("spaces");
  const [isPending, startTransition] = useTransition();

  // Local state for optimistic updates
  const [spaces, setSpaces] = useState(initialSpaces);
  const [users, setUsers] = useState(initialUsers);

  // Edit modals
  const [editingSpace, setEditingSpace] = useState<AdminSpace | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Delete confirms
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Edit form state
  const [editSpaceName, setEditSpaceName] = useState("");
  const [editSpaceDescription, setEditSpaceDescription] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");

  // Expanded user row for referral details
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  function openEditSpace(space: AdminSpace) {
    setEditSpaceName(space.name);
    setEditSpaceDescription(space.description ?? "");
    setEditingSpace(space);
  }

  function openEditUser(user: AdminUser) {
    setEditUserName(user.name ?? "");
    setEditUserEmail(user.email ?? "");
    setEditingUser(user);
  }

  function handleSaveSpace() {
    if (!editingSpace) return;
    const fd = new FormData();
    fd.set("spaceId", editingSpace.id);
    fd.set("name", editSpaceName);
    fd.set("description", editSpaceDescription);
    startTransition(async () => {
      await adminUpdateSpace(fd);
      setSpaces((prev) =>
        prev.map((s) => s.id === editingSpace.id ? { ...s, name: editSpaceName, description: editSpaceDescription || null } : s)
      );
      setEditingSpace(null);
    });
  }

  function handleDeleteSpace(id: string) {
    const fd = new FormData();
    fd.set("spaceId", id);
    startTransition(async () => {
      await adminDeleteSpace(fd);
      setSpaces((prev) => prev.filter((s) => s.id !== id));
      setDeletingSpaceId(null);
    });
  }

  function handleSaveUser() {
    if (!editingUser) return;
    const fd = new FormData();
    fd.set("userId", editingUser.id);
    fd.set("name", editUserName);
    fd.set("email", editUserEmail);
    startTransition(async () => {
      await adminUpdateUser(fd);
      setUsers((prev) =>
        prev.map((u) => u.id === editingUser.id ? { ...u, name: editUserName, email: editUserEmail } : u)
      );
      setEditingUser(null);
    });
  }

  function handleDeleteUser(id: string) {
    const fd = new FormData();
    fd.set("userId", id);
    startTransition(async () => {
      await adminDeleteUser(fd);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeletingUserId(null);
    });
  }

  // ── Shared styles ──

  const thClass = "px-4 py-3 font-medium text-left";
  const tdClass = "px-4 py-3";

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["spaces", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-[0.82rem] transition-all ${
              tab === t
                ? "bg-white/[0.08] text-text-primary font-medium"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "spaces" ? `Spaces (${spaces.length})` : `Users (${users.length})`}
          </button>
        ))}
      </div>

      {/* ── Spaces Tab ── */}
      {tab === "spaces" && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-white/[0.06] text-text-muted">
                <th className={thClass}>Name</th>
                <th className={thClass}>Members</th>
                <th className={thClass}>Obs</th>
                <th className={thClass}>Last Active</th>
                <th className={`${thClass} text-center`}>7d</th>
                <th className={`${thClass} text-center`}>30d</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {spaces.map((space) => (
                <tr key={space.id} className="border-b border-white/[0.04] last:border-0">
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      <ActivityDot lastActiveAt={space.lastActiveAt} />
                      <a href={`/dashboard/${space.id}`} className="text-cool-1 hover:underline">
                        {space.name}
                      </a>
                    </div>
                  </td>
                  <td className={`${tdClass} text-text-secondary`}>{space.memberCount}</td>
                  <td className={`${tdClass} text-text-secondary`}>{space.observationCount}</td>
                  <td className={`${tdClass} text-text-muted`}>{relativeTime(space.lastActiveAt)}</td>
                  <td className={`${tdClass} text-center text-text-secondary`}>{space.observationCount7d}</td>
                  <td className={`${tdClass} text-center text-text-secondary`}>{space.observationCount30d}</td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditSpace(space)}
                        className="rounded-md px-2 py-1 text-[0.72rem] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
                      >
                        Edit
                      </button>
                      {deletingSpaceId === space.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteSpace(space.id)}
                            disabled={isPending}
                            className="rounded-md px-2 py-1 text-[0.72rem] text-warm-1 hover:bg-warm-1/10 disabled:opacity-50"
                          >
                            {isPending ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeletingSpaceId(null)}
                            className="text-[0.72rem] text-text-muted hover:text-text-secondary"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeletingSpaceId(space.id)}
                          className="rounded-md px-2 py-1 text-[0.72rem] text-warm-1/70 hover:bg-warm-1/10 hover:text-warm-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {spaces.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">No spaces</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Users Tab ── */}
      {tab === "users" && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-[0.82rem]">
            <thead>
              <tr className="border-b border-white/[0.06] text-text-muted">
                <th className={thClass}>Name</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Tier</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Trial ends</th>
                <th className={thClass}>Last Active</th>
                <th className={`${thClass} text-center`}>7d</th>
                <th className={`${thClass} text-center`}>30d</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <tr className="border-b border-white/[0.04] last:border-0">
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <ActivityDot lastActiveAt={user.lastActiveAt} />
                        <span className="text-text-primary">{user.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className={`${tdClass} text-text-secondary`}>{user.email ?? "—"}</td>
                    <td className={`${tdClass} text-text-secondary capitalize`}>{user.tier ?? "—"}</td>
                    <td className={tdClass}><StatusBadge status={user.status} /></td>
                    <td className={tdClass}><TrialInfo trialEndsAt={user.trialEndsAt} status={user.status} /></td>
                    <td className={`${tdClass} text-text-muted`}>{relativeTime(user.lastActiveAt)}</td>
                    <td className={`${tdClass} text-center text-text-secondary`}>{user.observationCount7d}</td>
                    <td className={`${tdClass} text-center text-text-secondary`}>{user.observationCount30d}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        {user.referralCode && (
                          <button
                            onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                            className="rounded-md px-2 py-1 text-[0.72rem] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary"
                            title="Referral details"
                          >
                            Ref
                          </button>
                        )}
                        <button
                          onClick={() => openEditUser(user)}
                          className="rounded-md px-2 py-1 text-[0.72rem] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
                        >
                          Edit
                        </button>
                        {deletingUserId === user.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={isPending}
                              className="rounded-md px-2 py-1 text-[0.72rem] text-warm-1 hover:bg-warm-1/10 disabled:opacity-50"
                            >
                              {isPending ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => setDeletingUserId(null)}
                              className="text-[0.72rem] text-text-muted hover:text-text-secondary"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingUserId(user.id)}
                            className="rounded-md px-2 py-1 text-[0.72rem] text-warm-1/70 hover:bg-warm-1/10 hover:text-warm-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedUserId === user.id && (
                    <tr key={`${user.id}-ref`} className="border-b border-white/[0.04]">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex items-center gap-6 rounded-lg bg-white/[0.02] px-4 py-2 text-[0.75rem]">
                          <span className="text-text-muted">
                            Referral code: <span className="font-mono text-text-secondary">{user.referralCode}</span>
                          </span>
                          <span className="text-text-muted">
                            Discount: <span className="text-text-secondary">{user.referralDiscountPct ?? 0}%</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-text-muted">No users</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Space Modal ── */}
      {editingSpace && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingSpace(null); }}
        >
          <div className="relative w-[90%] max-w-[500px] rounded-2xl border bg-surface p-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => setEditingSpace(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-secondary" aria-label="Close">
              ✕
            </button>
            <h3 className="mb-4 font-display text-xl font-light text-text-primary">Edit space</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[0.75rem] text-text-muted">Name</label>
                <input
                  type="text"
                  value={editSpaceName}
                  onChange={(e) => setEditSpaceName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.75rem] text-text-muted">Description</label>
                <textarea
                  value={editSpaceDescription}
                  onChange={(e) => setEditSpaceDescription(e.target.value)}
                  className="w-full resize-y rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                  style={{ minHeight: "80px" }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingSpace(null)}
                  className="rounded-xl px-4 py-2.5 text-[0.82rem] text-text-muted hover:text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSpace}
                  disabled={isPending || !editSpaceName.trim()}
                  className="rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div className="relative w-[90%] max-w-[500px] rounded-2xl border bg-surface p-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-secondary" aria-label="Close">
              ✕
            </button>
            <h3 className="mb-4 font-display text-xl font-light text-text-primary">Edit user</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[0.75rem] text-text-muted">Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.75rem] text-text-muted">Email</label>
                <input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.85rem] text-text-primary outline-none focus:border-cool-1/30"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl px-4 py-2.5 text-[0.82rem] text-text-muted hover:text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={isPending || !editUserName.trim() || !editUserEmail.trim()}
                  className="rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
