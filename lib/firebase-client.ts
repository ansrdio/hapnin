"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Browser-side Firebase, used only for the email-link sign-in handshake. All of
// these values are public by design (they ship in the client bundle). Register a
// Web app in the Firebase console to get them, then set NEXT_PUBLIC_FIREBASE_*.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
export function getClientAuth(): Auth {
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}
