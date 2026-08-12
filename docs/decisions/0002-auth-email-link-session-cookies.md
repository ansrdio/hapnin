# ADR 0002 — Email-link auth with session cookies; admin by allowlist

**Status:** accepted (2026-08-11)

## Context

Buyers never authenticate (phone-keyed, no accounts). Organizers and admin need
login and server-enforced route protection for `/o/*` and `/admin/*`. We're on
Firebase Auth (ADR 0001), whose SDK is browser-first, but our guards run
server-side in the App Router. The spec calls for a magic-link login.

## Decision

- **Email-link (passwordless).** The browser completes `signInWithEmailLink`
  (Firebase Web SDK) and gets an ID token.
- **Session cookies for SSR.** The token is POSTed to `/api/auth/session`, which
  mints a Firebase **session cookie** (`createSessionCookie`, httpOnly, Secure,
  SameSite=Lax, 14d) via the Admin SDK. Every server request verifies it with
  `verifySessionCookie` in `lib/auth.ts`. No client-trusted auth state.
- **Roles.** Admin = the signed-in email is in the `ADMIN_EMAILS` allowlist (env).
  Organizer = an `organizers` doc matches the email; its `firebase_uid` is bound
  on first login. Team roles (`manager`/`door`) come in Phase 2, checked the same
  server-side way.
- **Guards live in layouts.** `app/admin/layout.tsx` and `app/o/layout.tsx` call
  `requireAdmin()` / `requireOrganizer()` (Node runtime) and redirect to
  `/login`. Middleware isn't used for verification (Edge can't run the Admin SDK).

## Consequence

- Route protection is real server-side verification, not a client check — correct
  for a system holding money and PII.
- Admin membership is an env allowlist: simple and controllable for one admin, but
  changing admins means an env change + redeploy (fine at this scale).
- The Firebase **Web app config** (`NEXT_PUBLIC_FIREBASE_*`) must exist and the
  auth domain be authorized, or login can't complete. These are public values.
- Session cookie verification adds a Firebase Admin call per protected request;
  negligible at this scale, cacheable later if needed.
