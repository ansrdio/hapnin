import "server-only";
// Back-compat shim: the landing/pitch actions import getDb + ALREADY_EXISTS from
// here. The real init now lives in firebase-admin.ts (shared with Auth).
export { getDb, ALREADY_EXISTS } from "./firebase-admin";
