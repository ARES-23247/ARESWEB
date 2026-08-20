const ACTIVE_TEAM_ROLES = new Set([
  "admin",
  "coach",
  "mentor",
  "member",
  "student",
  "parent",
  "lead",
]);

/** Mirrors the backend's active-team role contract for feature visibility. */
export function canUseMemberAi(role: unknown): boolean {
  return typeof role === "string" && ACTIVE_TEAM_ROLES.has(role);
}
