# Changelog

One line per merged feature, newest first.

## Pre-design — Eventbrite/Posh parity
- Guest list `/o/events/[id]/guests`: orders joined to buyer/tier/check-in; search; manual check-in, resend, refund.
- Refunds (`lib/refunds.ts`): full Stripe refund w/ transfer + fee reversal (destination charge), voids tickets, restores inventory + counters; idempotent.
- Promoter links (`lib/promoters.ts`): `?p=code` attribution through checkout → per-link tickets/gross/owed; refunds back it out.
- Promo codes (`lib/promos.ts`) + per-tier sale windows: server-computed discounts at checkout; on-sale/off-sale times enforced.
- Box office (`lib/boxoffice.ts`): cash/external-card door sales at `/scan/[eventId]/sell`, scannable tickets, no Stripe.
- Ticket transfers (`lib/transfers.ts`): send N tickets to another phone from the ticket page; QR stays valid, source deactivates.
- Waitlist (`lib/waitlist.ts`): sold-out events collect a waitlist; organizer texts a buy link.
- Analytics `/o/events/[id]/analytics`: gross/tickets/check-in/refunds + bars by day/tier/channel/source + top promoters.
- Wallet passes plumbing (`lib/wallet.ts`): signed Apple `.pkpass` + Google save JWT, dormant until creds (`docs/wallet-passes.md`).
- Deferred to the design pass: reserved tables / bottle service (inherently visual seat map).

## Phase 2 — the organizer's product
- Public organizer page `/o/{handle}`: identity + upcoming on-sale events (flyer, date, venue, from-price) linking to each `/e/{slug}`. Private dashboard moved under an `(dashboard)` route group so its auth layout doesn't gate this public page.
- Shared UI kit (`app/components/ui.tsx`): page shell, cards, buttons, inputs, stats, status badges — one visual language for every product screen.
- Organizer dashboard `/o`: their events with live sold/gross, aggregate totals, payout-status nudge, empty state.
- Full event builder `/o/events/new`: dynamic ticket tiers (add/remove), category vocabulary, save-as-draft or publish; shared form parser (`lib/event-input.ts`) used by admin + organizer so validation never drifts.
- Event manage `/o/events/[id]`: live stats, per-tier sold/remaining, publish/unpublish/cancel, shareable link, door-scanner + preview links. Ownership-checked.
- Flyer upload: organizer-authed `/api/upload/flyer` streams images into Firebase Storage (Admin SDK) with a download token for public read; reusable `FlyerUpload` picker in the builder + manage page; thumbnails on the dashboard.
- Comps (`lib/comps.ts`): issue free passes from the manage page — reserves tier inventory, `channel="comp"` order + `is_comp` tickets with signed QR, texts the guest, counts toward capacity but never gross.
- Broadcasts (`lib/broadcasts.ts`): text an event's opted-in buyers from the manage page (audience = ticket buyers who consented at checkout; comps excluded); records a `broadcasts` doc, appends the STOP footer, delivers via sendSMS.
- Team members (`lib/team.ts`): owner adds managers (full dashboard) or door staff (scanner only) by email at `/o/team`; role-aware guards (`requireOrganizer` owner+manager, `requireScanAccess` +door, `requireOwner`) resolve access from ownership or team membership.
- (Next: public `/o/{handle}`, buyer-facing polish.)

## Phase 1 — the demo loop
- Event data + atomic inventory (`reserveInventory`/`releaseInventory` via Firestore transactions); signed HMAC QR tokens; public `/e/{slug}`; minimal admin event-create.
- Checkout `/e/{slug}/checkout`: quantity, buyer details, ZIP, pre-checked opt-in, Nollywood question; Stripe Payment Element (Apple/Google Pay + card).
- Payment: destination-charge PaymentIntent (`transfer_data.destination` + `on_behalf_of` + `application_fee_amount`, 0 on first event); amounts computed server-side; buyers cover card processing.
- Webhook `payment_intent.succeeded` → buyer (phone-keyed) + order (frozen `days_before_event`) + one ticket per admission + verbatim consent + counters + ticket SMS; idempotent. Failure/cancel releases the hold.
- Ticket page `/t/{orderId}` (server-rendered QR); confirmation page polls until the webhook lands.
- Door scanner `/scan/{eventId}`: camera (ZXing), server-verified check-in, first-check-in-wins (transaction), green/red + name + running count. (Wallet passes + offline deferred to Phase 3.)

## Phase 0 — foundations
- Firebase Admin core shared by Firestore + Auth (`lib/firebase-admin.ts`).
- Vocabulary enums as validated constants (`lib/enums.ts`); Firestore data model (`docs/data-dictionary.md`).
- Email-link auth with Firebase session cookies; `/admin/*` and `/o/*` route guards; admin by `ADMIN_EMAILS` allowlist.
- Admin: create organizer (handle reserved atomically), organizer detail, organizers list.
- Stripe Connect Express onboarding (create account → account link); `account.updated` webhook flips `stripe_onboarded` (idempotent via `webhook_events`).
- `sendSMS()` service with Twilio + dev-mode console fallback; admin "send test SMS".
- Docs: ADR 0001 (Firestore over Postgres), ADR 0002 (auth), architecture, data dictionary.
