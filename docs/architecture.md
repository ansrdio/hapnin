# Hapnin — architecture (one page)

Next.js App Router + TypeScript + Tailwind on Vercel. **Cloud Firestore** (Admin
SDK) for data, **Firebase Auth** (email-link) for organizers/admin, **Firebase
Storage** for flyers, **Stripe Connect** (Express, destination charges) for money,
**Twilio** for SMS. Buyer-facing pages are the brand at full energy; organizer/admin
pages are calm and functional.

## Two rules that never bend

1. **Money never rests in the platform balance.** Ticket money settles to the
   organizer's own Stripe account via **destination charges**: the PaymentIntent is
   created on the platform with `transfer_data.destination` = the organizer's
   connected account, `on_behalf_of` = same (organizer is merchant of record), and
   `application_fee_amount` = Hapnin's cut. If any change would route funds through
   the platform balance, stop.
2. **Buyers are keyed on phone (E.164) and never authenticate.** No buyer accounts.
   Cross-event, cross-organizer repeat tracking is the whole thesis and it dies on
   email.

## Security model (see ADR 0001)

The Admin SDK bypasses Firestore Security Rules, so **client access to product
collections is denied entirely**. Every read/write goes through a server action or
route handler that checks auth + role + org ownership. Door-vs-manager separation
(door staff see no revenue or buyer contacts) is a server-guard invariant, not a DB
policy. `buyers` and `consent_log` are admin/service-only — never organizer-facing.

## Auth flow (see ADR 0002)

`/login` (browser) → email-link → `signInWithEmailLink` → ID token → POST
`/api/auth/session` → Firebase **session cookie** (httpOnly). Server guards
`requireAdmin()` / `requireOrganizer()` verify the cookie per request. Admin = email
in `ADMIN_EMAILS`; organizer = matching `organizers` doc (uid bound on first login).

## The purchase flow (Phase 1 — being built)

```
buyer on /e/{slug}
  → checkout (name, phone→E.164, email, zip, consent, screening Q)
  → reserve_tier_inventory  (Firestore runTransaction on the tier: reject if oversold)
  → create PaymentIntent  (destination charge → organizer; application_fee to Hapnin)
  → [Apple/Google Pay or card]  → Stripe
  → webhook payment_intent.succeeded  (idempotent via webhook_events/{id})
        → find-or-create buyer (by phone)  → order (days_before_event frozen)
        → one ticket per admission (signed HMAC QR)
        → sendSMS(ticket link)
  → confirmation page (QR immediately) ; on failure/expiry → release_tier_inventory
```

Every money amount is computed server-side from Firestore, never trusted from the
client. Inventory is reserved *before* the PaymentIntent and released on
failure/expiry by the reconciliation job.

## Offline door scanning (Phase 3)

Scanner caches the guest list (service worker + IndexedDB), validates scans locally,
queues them, and syncs on reconnect. Conflict rule: **first check-in wins**; a later
duplicate shows red with the original check-in time. Concurrent scanners must never
double-admit.

## Route map

- Public/buyer: `/`, `/e/{slug}` (P1), `/o/{handle}` (P2), `/pitch`, `/why`
- Organizer (auth): `/o`, `/scan` (P1)
- Admin (auth): `/admin`, `/admin/organizers/{id}`
- API: `/api/auth/session`, `/api/stripe/webhook`, (P1) `/api/twilio/*`
