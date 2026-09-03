import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/account";
import { getAllSpacesWithDetails, getAllUsersWithDetails } from "@/lib/db/queries";
import { AdminDashboard } from "./admin-dashboard";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!isSuperAdmin(session.user.email)) redirect("/dashboard");

  const [spaces, users] = await Promise.all([
    getAllSpacesWithDetails(),
    getAllUsersWithDetails(),
  ]);

  // Serialise dates for client component
  // lastActiveAt comes from raw SQL — may be a Date or ISO string depending on driver
  const toISO = (v: Date | string | null | undefined): string | null => {
    if (!v) return null;
    return v instanceof Date ? v.toISOString() : String(v);
  };

  const serialisedSpaces = spaces.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    lastActiveAt: toISO(s.lastActiveAt),
  }));

  const serialisedUsers = users.map((u) => ({
    ...u,
    trialEndsAt: u.trialEndsAt ? u.trialEndsAt.toISOString() : null,
    lastActiveAt: toISO(u.lastActiveAt),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
      <h1 className="font-display text-3xl font-light text-text-primary">
        Admin
      </h1>
      <p className="mt-2 text-[0.85rem] text-text-secondary">
        Super admin dashboard. You have access to all spaces and users.
      </p>

      <div className="mt-6">
        <a
          href="/admin/evaluation"
          className="inline-flex rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-[0.78rem] text-cool-1 hover:bg-white/[0.05]"
        >
          View model evaluation →
        </a>
      </div>

      <div className="mt-8">
        <AdminDashboard spaces={serialisedSpaces} users={serialisedUsers} />
      </div>
    </div>
  );
}
