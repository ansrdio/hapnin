import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

// Single Firebase Admin app for the whole server. The Admin SDK bypasses
// Firestore Security Rules, so every product read/write must go through a server
// action / route handler that checks auth + role + org ownership (see ADR 0001).

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY."
    );
  }
  privateKey = privateKey.replace(/\\n/g, "\n"); // Vercel stores \n literally
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

let db: Firestore | null = null;
export function getDb(): Firestore {
  if (!db) db = getFirestore(getAdminApp());
  return db;
}

let authAdmin: Auth | null = null;
export function getAdminAuth(): Auth {
  if (!authAdmin) authAdmin = getAuth(getAdminApp());
  return authAdmin;
}

/** Firestore's ALREADY_EXISTS gRPC status — thrown by doc.create() on a dup. */
export const ALREADY_EXISTS = 6;
