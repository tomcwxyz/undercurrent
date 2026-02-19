import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMemberRole,
  getSpaceById,
  getSpaceMembers,
  getInvitationsForSpace,
} from "@/lib/db/queries";
import { canEditSpace } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { spaceId } = await params;
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canEditSpace(role as SpaceRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const [space, members, invitationRows] = await Promise.all([
    getSpaceById(spaceId),
    getSpaceMembers(spaceId),
    getInvitationsForSpace(spaceId),
  ]);

  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const now = new Date();
  const invitations = invitationRows.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expired: inv.expiresAt < now,
    accepted: !!inv.acceptedAt,
  }));

  return NextResponse.json({
    name: space.name,
    description: space.description,
    environment: space.environment ?? "stars",
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name ?? "Anonymous",
      email: m.email ?? "",
      role: m.role,
    })),
    invitations,
  });
}
