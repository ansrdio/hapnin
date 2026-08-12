# Changelog

One line per merged feature, newest first.

## Phase 0 — foundations
- Firebase Admin core shared by Firestore + Auth (`lib/firebase-admin.ts`).
- Vocabulary enums as validated constants (`lib/enums.ts`); Firestore data model (`docs/data-dictionary.md`).
- Email-link auth with Firebase session cookies; `/admin/*` and `/o/*` route guards; admin by `ADMIN_EMAILS` allowlist.
- Admin: create organizer (handle reserved atomically), organizer detail, organizers list.
- Stripe Connect Express onboarding (create account → account link); `account.updated` webhook flips `stripe_onboarded` (idempotent via `webhook_events`).
- `sendSMS()` service with Twilio + dev-mode console fallback; admin "send test SMS".
- Docs: ADR 0001 (Firestore over Postgres), ADR 0002 (auth), architecture, data dictionary.
