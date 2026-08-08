import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-only Firestore client via the Firebase Admin SDK (a service account).
// The admin SDK bypasses security rules, so signups only ever flow through the
// server actions — lock the client-facing rules down to deny-all.
//
// Never import this from a client component — `server-only` will hard-error the
// build if it's ever pulled into a client bundle.

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  // Vercel (and .env) store the multi-line key with literal "\n" — restore them.
  privateKey = privateKey.replace(/\\n/g, "\n");

  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

  db = getFirestore(app);
  return db;
}

/** Firestore's ALREADY_EXISTS gRPC status — thrown by doc.create() on a dup. */
export const ALREADY_EXISTS = 6;
