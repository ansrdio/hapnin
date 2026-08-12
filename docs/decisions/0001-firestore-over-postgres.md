# ADR 0001 — Firestore instead of the specced Postgres/Supabase

**Status:** accepted (2026-08-11) · overrides the datastore in `hapnin-mvp-spec.md` and `001_hapnin_schema.sql`

## Context

The MVP spec and `001_hapnin_schema.sql` are written for Supabase/Postgres: ~20 enum
types, Row-Level Security, SQL functions (`reserve_tier_inventory`), a trigger, and
analytics views (`event_repeat_rate`). The pre-launch site (landing, `/pitch`, `/why`)
was already migrated to **Cloud Firestore**, and there is no Supabase project. The
owner chose to build the product on Firestore too, keeping one backend.

## Decision

Build the entire product on Firestore (Firebase Admin SDK server-side) with Firebase
Auth (email-link) for organizers/admin and Firebase Storage for flyers. The SQL schema
and the missing `002_promoters_teams.sql` are **not** run; they become the reference
model that `docs/data-dictionary.md` ports to collections.

The three load-bearing invariants from the schema are preserved, by other means:

- **Atomic inventory** — `reserve_tier_inventory`'s "never read-then-write" becomes a
  Firestore `runTransaction` on the tier doc: read `quantity_sold`, reject if
  `+qty > quantity_total`, else write. Same guarantee, different mechanism.
- **Append-only consent** — Postgres `do instead nothing` rules become: consent docs
  are only ever created, never updated or deleted, enforced in the one service that
  writes them (`recordConsent`) and in Security Rules (client access denied entirely).
- **Frozen `days_before_event`** — the insert trigger becomes an explicit server-side
  computation at order creation. Never derived later.

## Consequence

- **Security lives in application code, not the database.** Postgres RLS enforced
  organizer scoping and the buyers/`consent_log` firewall ("your asset, org-facing
  never"). Firestore's Admin SDK bypasses Security Rules, so client access to all
  product collections is **denied by default** and every read/write goes through a
  server action/route handler that checks auth + role + org ownership. Door-vs-manager
  separation (door staff see no revenue, no buyer contacts) is a server-guard
  invariant with tests, not a `create policy`. This is the single biggest risk this
  decision creates and is treated as a hard rule.
- **Analytics are app-side.** No SQL views. `event_repeat_rate`, zip catchment,
  lead-time, cross-organizer history, and "CSV of every table" (Phase 4) become
  Firestore queries + denormalized counters, which is more code and less flexible than
  a view. Acceptable at one-organizer scale; revisit (e.g. BigQuery export) if it grows.
- **No ad-hoc SQL** for debugging/ops; reads go through code or the Firestore console.
- **Reversibility:** low. Moving back to Postgres later means a real data migration.
  That is the cost of record; the decision was made deliberately for backend simplicity.
