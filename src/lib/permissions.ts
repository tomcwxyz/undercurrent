import type { SpaceRole } from "@/lib/types";

const ROLE_HIERARCHY: Record<SpaceRole, number> = {
  owner: 4,
  admin: 3,
  facilitator: 2,
  observer: 1,
  viewer: 0,
};

function hasMinRole(userRole: SpaceRole, minRole: SpaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function canEditSpace(role: SpaceRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageMembers(role: SpaceRole): boolean {
  return hasMinRole(role, "admin");
}

export function canCreateObservation(role: SpaceRole): boolean {
  return hasMinRole(role, "observer");
}

export function canDeleteSpace(role: SpaceRole): boolean {
  return role === "owner";
}
