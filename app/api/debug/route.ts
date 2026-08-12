import { NextResponse } from "next/server";

// TEMPORARY diagnostic — remove after Phase 0 is verified. Surfaces the real
// Firebase Admin error instead of a generic 500.
export const runtime = "nodejs";

export async function GET() {
  const out: Record<string, unknown> = {
    env: {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY_len: (process.env.FIREBASE_PRIVATE_KEY || "").length,
      FIREBASE_PRIVATE_KEY_starts: (process.env.FIREBASE_PRIVATE_KEY || "").slice(0, 32),
      ADMIN_EMAILS: !!process.env.ADMIN_EMAILS,
    },
  };
  try {
    const { getDb } = await import("@/lib/firebase-admin");
    const snap = await getDb().collection("organizers").limit(1).get();
    out.firestore = `ok — ${snap.size} organizer doc(s)`;
  } catch (e) {
    const err = e as Error;
    out.firestoreError = err?.message ?? String(e);
    out.stack = String(err?.stack ?? "").split("\n").slice(0, 5);
  }
  return NextResponse.json(out);
}
