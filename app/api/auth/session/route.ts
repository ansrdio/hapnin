import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getOrganizerByEmail, linkOrganizerUid } from "@/lib/organizers";
import { isAdminEmail, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export const runtime = "nodejs";

// POST { idToken } — the browser sends the ID token from a completed email-link
// sign-in; we mint a Firebase session cookie (httpOnly) and set it. Also binds
// the Firebase uid to a matching organizer on first login, and reports where to
// send the user (admin vs organizer) so the client can redirect.
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

  // Determine role. Organizers are bound by uid on first login.
  let role: "admin" | "organizer" | "none" = "none";
  if (isAdminEmail(email)) {
    role = "admin";
  } else {
    const organizer = await getOrganizerByEmail(email);
    if (organizer) {
      role = "organizer";
      if (!organizer.firebase_uid) await linkOrganizerUid(organizer.id, decoded.uid);
    }
  }
  if (role === "none") {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

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
  return NextResponse.json({ ok: true, role });
}

// DELETE — sign out.
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
