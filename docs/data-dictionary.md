# Hapnin — data dictionary (Firestore)

Ports `001_hapnin_schema.sql` to Firestore collections. Enums live in `lib/enums.ts`
and are validated on every write. Money is always in **integer cents**. Timestamps are
Firestore `Timestamp` (UTC); event times render in `events.timezone`.

**Access rule (see ADR 0001):** clients never read/write these collections directly —
Security Rules deny all client access. Every read/write goes through a server action or
route handler using the Admin SDK, which checks auth + role + org ownership. Phone is
normalized to **E.164** before any buyer write.

---

## `organizers/{organizerId}`
The account. One per organizer (Aura Collective is the first).
- `firebase_uid` (string, unique) — Firebase Auth user; null until they log in
- `name`, `handle` (unique, lowercased — powers `/o/{handle}`), `instagram_handle`, `email`, `phone`
- `stripe_account_id` (string, unique), `stripe_onboarded` (bool, default false)
- `marketing_approved` (bool, default false) — admin gate; marketing sends blocked until true
- `created_at`
- **Uniqueness:** `handle` guarded by a `handles/{handle}` lookup doc (create-fails-if-exists).

## `organizers/{organizerId}/team/{memberPhone}`
Door staff & managers (ports the missing `002`). Server guards read this for every `/o/*` and `/scan` request.
- `role` — `manager` (sees dashboard) | `door` (scan + door-sell only; **never** revenue or buyer contacts)
- `name`, `invited_at`, `accepted_at`, `firebase_uid` (once they accept the SMS invite link)

## `events/{eventId}`
- `organizer_id`, `title`, `slug` (unique → `event_slugs/{slug}` lookup doc), `description`, `flyer_url`
- Denormalized venue: `venue_name`, `venue_address`, `city`, `state` (venues are v1.5)
- `starts_at`, `doors_at`, `timezone` (default `America/Phoenix`)
- `status` — `EVENT_STATUS`; `capacity`
- **Classification:** `category` (one), `scene_tags` (string[]), optional `primary_language` / `genre`, `talent` (string[]); legacy `event_type` / `community` retained
- `on_sale_at`, `created_at`
- **Counters** (denormalized for the dashboard, updated in the same transaction as writes): `tickets_sold`, `gross_cents`.

### `events/{eventId}/tiers/{tierId}`
- `name`, `price_cents` (≥0), `quantity_total` (>0), `quantity_sold` (default 0)
- `sales_start_at`, `sales_end_at`, `is_active`, `sort_order`, `zone_id` (null = GA)
- **Inventory is reserved by a `runTransaction` on this doc** — read `quantity_sold`, reject if `+qty > quantity_total`, else increment. Never read-then-write outside a transaction.

### `events/{eventId}/waitlist/{buyerPhone}`
Demand signal. `tier_id?`, `notified_at?`, `created_at`. Doc-id = phone enforces one entry per buyer per event.

### `events/{eventId}/promoter_links/{code}` (Phase 3)
`promoter_id`, `created_at`. `?ref={code}` on the event URL resolves here; lands on `orders.promoter_link_id`.

## `talent_canonical/{nameKey}`
Autocomplete source so "Burna Boy" resolves to one string. `name`, `use_count`. Doc-id = lowercased name.

## `buyers/{e164Phone}`  ← **doc id IS the phone**
The thesis: one person, one phone, tracked across every event and organizer. Never client-accessible; admin/service only.
- `phone` (E.164, = id), `email?`, `first_name?`, `last_name?`
- `postal_code` (required — the catchment map), `city?`, `state?`
- `sms_marketing_opt_in`, `email_marketing_opt_in`, `sms_opted_out_at?`, `email_opted_out_at?`
- `screening_interest` (bool | null — the Nollywood question; null = not asked)
- `first_event_id?`, `created_at`
- **Find-or-create by phone runs in a transaction** so concurrent checkouts don't double-create.

### `buyers/{phone}/consent/{autoId}` — append-only
TCPA evidence. **Only ever created — never updated or deleted** (enforced in `recordConsent` + rules).
- `scope`, `channel`, `action`, `source`, `event_id?`
- `ip_address`, `user_agent`, `consent_text` (**verbatim** — the exact words shown), `created_at`

## `orders/{orderId}`
- `event_id`, `buyer_id` (phone), `tier_id`, `quantity` (>0)
- `subtotal_cents`, `fee_cents`, `total_cents` — **all computed server-side from the DB, never trusted from the client**
- `stripe_payment_intent_id` (unique), `status` (`ORDER_STATUS`), `channel` (`SALE_CHANNEL`)
- **Signal fields, frozen at purchase:** `days_before_event` (computed at insert, never re-derived), `referral_source?`, `promoter_link_id?`
- `created_at`
- **Idempotency:** created only by the webhook, keyed off the PaymentIntent so a Stripe retry can't create it twice (see `webhook_events`).

## `tickets/{ticketId}` — one doc per admitted person
- `order_id`, `event_id`, `buyer_id` (phone; **changes on transfer**), `zone_id?`
- `qr_token` — QR encodes `ticketId` + an **HMAC signature** (signed, not sequential); scanner verifies the signature, then reads the ticket
- `is_comp` (bool)
- `checked_in_at?`, `checked_in_by?` (team member) — **first check-in wins**
- `transferred_from_buyer_id?`, `transferred_at?`, `created_at`

## `messages/{messageId}` + `messages/{messageId}/recipients/{buyerPhone_channel}`
- Message: `organizer_id`, `event_id?` (null = cross-event marketing), `kind` (`MESSAGE_KIND`), `channel`, `subject?`, `body`, `recipient_filter` (map), `status`, `scheduled_for?`, `sent_at?`, `recipient_count`
- Recipient: `buyer_id`, `channel`, `provider_message_id?`, `status` (`DELIVERY_STATUS`), `error?`, `delivered_at?` — updated from Twilio callbacks
- **Marketing (`kind = marketing`) is blocked unless the organizer's `marketing_approved` is true.**

## System collections
- `webhook_events/{stripeEventId}` — idempotency ledger; created once per Stripe event so retries are no-ops.
- `handles/{handle}`, `event_slugs/{slug}` — uniqueness guards.
- `pending_holds/{holdId}` — inventory reserved at checkout with a TTL; the reconciliation job releases expired holds.

---

## The vocabulary, in plain language
These four fields are the taxonomy the "map" (and a future Inskriba join) depends on. Dropdowns only.

- **`category`** — what kind of event it is, exactly one (see `lib/taxonomy.ts`): `nightlife`, `live_music`, `film`, `comedy`, `culture`, `business`, `faith`, `food`, `festival`, `other`.
- **`scene_tags`** — the scenes, cultures, sounds or formats the *event* is built around, zero or more ids: music (`afrobeats`, `amapiano`, `afro_house`, `highlife`, `dancehall`, `soca`, `rnb`, `hip_hop`), culture (`nigerian`, `ghanaian`, `south_african`, `ethiopian`, `kenyan`, `caribbean`, `jamaican`, `trinidadian`, `pan_african`), format (`day_party`, `owambe`, `nollywood`, `independence`, `homecoming`, `young_professionals`, `students`). They describe the event, never the buyer; nobody is labelled by what they bought.
- **`primary_language`** — optional; `null` means not specified (never assumed). Values unchanged.
- **`genre`** — optional; prominent in the form only for nightlife / live music / festival. Values unchanged.
- **Legacy (kept for one release, still written where a clean mapping exists):** `event_type`, `community`. Reads normalize — an event without `category`/`scene_tags` derives them from these. `scripts/migrate-event-taxonomy.ts` writes the derived values once.

Other enums (`order_status`, `sale_channel`, `referral_source`, `consent_*`, `message_*`, `delivery_status`, `layout/zone_*`) are operational and defined in `lib/enums.ts`.
