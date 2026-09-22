import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getOrganizerByEmail, linkOrganizerUid } from "@/lib/organizers";
import { findTeamMembership } from "@/lib/team";
import { isAdminEmail, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { decideSessionRole } from "@/lib/session-role";

export const runtime = "nodejs";

// POST { idToken } — the browser sends the ID token from a completed email-link
// sign-in; we mint a Firebase session cookie (httpOnly) and set it. Also binds
// the Firebase uid to a matching organizer on first login, and reports where to
// send the user (admin / organizer dashboard / door scanner).
//
// Team members (manager, door) are accepted here exactly as the login-link
// sender and lib/auth resolveAccess accept them — the three must agree, or a
// door member gets a link that then 403s.
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "missing_id_token" }, { status: 400 });

  const auth = getAdminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const email = decoded.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "no_email" }, { status: 401 });

  const isAdmin = isAdminEmail(email);
  const organizer = isAdmin ? null : await getOrganizerByEmail(email);
  const membership = isAdmin || organizer ? null : await findTeamMembership(email);

  const decision = decideSessionRole({
    isAdmin,
    isOrganizer: !!organizer,
    membershipRole: membership?.role ?? null,
  });
  if (!decision) return NextResponse.json({ error: "not_authorized" }, { status: 403 });

  if (organizer && !organizer.firebase_uid) await linkOrganizerUid(organizer.id, decoded.uid);

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE * 1000,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return NextResponse.json({ ok: true, role: decision.role, landing: decision.landing });
}

// DELETE — sign out.
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
