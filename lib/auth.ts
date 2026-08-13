import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "./firebase-admin";
import { getOrganizerByUid, getOrganizerByEmail, getOrganizerById, type Organizer } from "./organizers";
import { findTeamMembership } from "./team";

// Auth model (see ADR 0002): the browser completes an email-link sign-in with the
// Firebase Web SDK, gets an ID token, and POSTs it to /api/auth/session, which
// mints a Firebase *session cookie* (httpOnly). Every server request verifies
// that cookie here. Admin is an email allowlist (ADMIN_EMAILS); organizers are
// matched by firebase_uid, falling back to email on first login.

export const SESSION_COOKIE = "hapnin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days, in seconds

export type SessionUser = { uid: string; email: string };

/** Verify the session cookie. Returns null if missing/invalid. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    if (!decoded.email) return null;
    return { uid: decoded.uid, email: decoded.email.toLowerCase() };
  } catch {
    return null;
  }
}

export function isAdminEmail(email: string): boolean {
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

/** Guard for /admin/* — redirects to login if not a signed-in admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) redirect("/login?denied=1");
  return user;
}

// Access role for an organizer's workspace. "owner" is the organizer themselves;
// "manager"/"door" are team members (lib/team).
export type OrgRole = "owner" | "manager" | "door";

/** Resolve which organizer workspace this user can act in, and in what role. */
async function resolveAccess(user: SessionUser): Promise<{ organizer: Organizer; role: OrgRole } | null> {
  const owned = (await getOrganizerByUid(user.uid)) ?? (await getOrganizerByEmail(user.email));
  if (owned) return { organizer: owned, role: "owner" };
  const membership = await findTeamMembership(user.email);
  if (membership) {
    const org = await getOrganizerById(membership.organizerId);
    if (org) return { organizer: org, role: membership.role };
  }
  return null;
}

/** Guard for /o/* — owner or manager. Door-only members are sent to the scanner. */
export async function requireOrganizer(): Promise<{ user: SessionUser; organizer: Organizer; role: OrgRole }> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/o");
  const access = await resolveAccess(user);
  if (!access) redirect("/login?denied=1");
  if (access.role === "door") redirect("/scan"); // door staff can't manage
  return { user, organizer: access.organizer, role: access.role };
}

/** Guard for /scan/* — owner, manager, or door staff. */
export async function requireScanAccess(): Promise<{ user: SessionUser; organizer: Organizer; role: OrgRole }> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/scan");
  const access = await resolveAccess(user);
  if (!access) redirect("/login?denied=1");
  return { user, organizer: access.organizer, role: access.role };
}

/** Guard for owner-only actions (e.g. managing the team). */
export async function requireOwner(): Promise<{ user: SessionUser; organizer: Organizer }> {
  const { user, organizer, role } = await requireOrganizer();
  if (role !== "owner") redirect("/o");
  return { user, organizer };
}
