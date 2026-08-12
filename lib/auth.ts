import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "./firebase-admin";
import { getOrganizerByUid, getOrganizerByEmail, type Organizer } from "./organizers";

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

/** Guard for /o/* — redirects to login if not a signed-in organizer. */
export async function requireOrganizer(): Promise<{ user: SessionUser; organizer: Organizer }> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/o");
  const organizer = (await getOrganizerByUid(user.uid)) ?? (await getOrganizerByEmail(user.email));
  if (!organizer) redirect("/login?denied=1");
  return { user, organizer };
}
