// Who may mint a session, and where to send them afterwards. Pure so it can be
// unit-tested; /api/auth/session gathers the three facts and calls this.
//
// Contract (ADR 0002 + lib/team): admins by allowlist, organizers by their own
// record, and team members (manager or door) by a team_members row. Anyone
// else is refused. The rest of the app re-derives the role on every request
// via lib/auth resolveAccess — this only decides the login handshake.

import type { TeamRole } from "./enums";

export type SessionRole = "admin" | "organizer" | "team";

export type SessionDecision = {
  role: SessionRole;
  /** Where the login page sends the user when no ?next= was requested. */
  landing: "/admin" | "/o" | "/scan";
};

export function decideSessionRole(facts: {
  isAdmin: boolean;
  isOrganizer: boolean;
  membershipRole: TeamRole | null;
}): SessionDecision | null {
  if (facts.isAdmin) return { role: "admin", landing: "/admin" };
  if (facts.isOrganizer) return { role: "organizer", landing: "/o" };
  if (facts.membershipRole === "manager") return { role: "team", landing: "/o" };
  if (facts.membershipRole === "door") return { role: "team", landing: "/scan" };
  return null;
}
