# Hapnin — MVP Specification

**Target:** first live event on the platform by end of month
**Principle:** the product's job is to capture the audience relationship and structured signal. Ticketing is the delivery mechanism, not the point.

---

## 1. The three users

| User | What they need | Where they are |
|---|---|---|
| **Buyer** | Get a ticket in under 60 seconds on a phone, and still have it at the door | Instagram → link in bio → checkout, usually late at night, on mobile data |
| **Organizer** | See sales, get paid, run the door without stress | Phone, sometimes a laptop |
| **You (admin)** | The cross-event picture nobody else has | Laptop |

Everything below serves one of these three. If a feature doesn't, it's cut.

---

## 2. Data model

Five tables. Get the enums right — they're the whole architecture and they cannot be retrofitted.

### `organizers`
```
id
name
instagram_handle
email
phone
stripe_account_id        -- Stripe Connect Express account
created_at
```

### `events`
```
id
organizer_id             → organizers.id
title
slug                     -- hapnin.now/e/{slug}
description
flyer_url
venue_name
venue_address
city
state
starts_at
doors_at
timezone
status                   ENUM: draft | on_sale | sold_out | past | cancelled
capacity

-- THE VOCABULARY FIELDS (dropdowns, never free text)
event_type               ENUM: music | film | comedy | cultural | nightlife | food | faith | conference
community                ENUM: nigerian | ghanaian | pan_african | francophone | east_african | caribbean | other
primary_language         ENUM: english | pidgin | yoruba | igbo | hausa | french | swahili | mixed
genre                    ENUM: afrobeats | amapiano | highlife | gospel | hip_hop | alte | fuji | nollywood | documentary | standup | other
talent                   -- array of canonical names, autocomplete from existing values

on_sale_at
created_at
```

**Why the enums matter:** these four fields are what let the abroad data join to Inskriba's home-side records later. If an organizer types "afro night" as free text, that row is worthless to the map. Force the dropdown even when it annoys them.

**Talent autocomplete is non-negotiable** — "Burna Boy" and "burna boy" and "Burnaboy" must resolve to one canonical string, or talent-level analysis is impossible.

### `venues` *(v1.5)*
```
id
organizer_id             → organizers.id, NULL if shared/public venue
name
address
city
state
default_capacity
layout_kind              ENUM: ga | zoned | seated
created_at
```

Venues are reusable. Organizers run the same three or four rooms over and over — making the venue an entity rather than a text field on the event means layouts get configured once, and it gives you venue-level attendance history for free.

### `zones` *(v1.5 — tables, sections, tiers of a room)*
```
id
venue_id                 → venues.id
name                     -- "VIP Table 3", "Balcony", "Floor"
kind                     ENUM: table | section | standing
seat_count               -- 8 for a table, NULL for open standing
position_x               -- optional, for visual rendering
position_y
shape                    ENUM: round | rect | block
sort_order
```

### `seats` *(v2 — per-seat assignment only)*
```
id
zone_id                  → zones.id
row_label
seat_number
position_x
position_y
status                   ENUM: available | held | sold | blocked
```

Do not create `seats` rows until you actually sell assigned seating. A zoned room needs zones and a counter, nothing more.

### `ticket_tiers`
```
id
event_id                 → events.id
zone_id                  → zones.id, NULL for general admission
name                     -- "Early Bird", "General", "VIP Table"
price_cents
quantity_total
quantity_sold
sales_start_at
sales_end_at
is_active
```

### `orders`
```
id
event_id                 → events.id
buyer_id                 → buyers.id
tier_id                  → ticket_tiers.id
quantity
subtotal_cents
fee_cents
total_cents
stripe_payment_intent_id
status                   ENUM: pending | paid | refunded | failed
created_at

-- SIGNAL FIELDS (computed at purchase, never later)
days_before_event        -- INTEGER. Compute at insert. This is the lead-time curve.
referral_source          ENUM: instagram | whatsapp | friend | organizer | search | flyer | other
```

`days_before_event` must be written at purchase time. Deriving it later from timestamps works until an event date changes, and event dates change.

### `buyers`
```
id
email
phone
first_name
last_name
postal_code              -- REQUIRED. This is the catchment map.
city                     -- derived from postal_code
opted_in                 BOOLEAN
opted_in_at
screening_interest       BOOLEAN NULL   -- "would you come to a Nollywood screening?"
first_event_id
created_at
```

Buyer is keyed on **phone number**, not email. Same person uses three email addresses and one phone. This is what makes cross-event repeat tracking actually work — and repeat attendance is the metric the whole thesis rests on.

### `tickets`
```
id
order_id                 → orders.id
qr_code                  -- signed token, not a sequential ID
checked_in_at            NULL until scanned
checked_in_by
```

One row per admitted person, not per order. An order of 4 creates 4 tickets.

---

## 3. Buyer flow

Three screens. No account creation, ever.

### Screen 1 — Event page (`hapnin.now/e/{slug}`)

- Flyer image, full bleed, top of page
- Title, date, time, venue name + address (address links to Maps)
- Short description
- Ticket tiers with prices; sold-out tiers greyed, not hidden — scarcity sells
- One button: **Get Tickets**

Mobile-first, single column, under 200KB. Flyer lazy-loads. This page gets opened on 4G in a car.

### Screen 2 — Checkout

Fields, in this order:
1. Quantity (stepper, default 1)
2. First name, last name
3. **Phone** (primary key — validate format)
4. Email
5. **Zip code** — required, labelled "so we can tell you about events near you"
6. `[ ] Tell me about other African events near me` — **pre-checked**
7. `Would you come to a Nollywood screening in Phoenix?` — Yes / No / Maybe. Optional, one tap.
8. Apple Pay / Google Pay button, card fields below

The zip label matters. Asked cold it feels like data collection; framed as a benefit it converts. Same for the pre-checked opt-in — legal in the US for this purpose, and the difference between 40% and 85% opt-in.

The screening question is the cheapest possible test of the assumption the entire business rests on. It costs one tap and answers in month one what would otherwise take two years.

### Screen 3 — Confirmation

- QR code rendered on-page immediately
- "Add to Apple Wallet / Google Wallet"
- SMS sent with a link to the same ticket
- "Save this text — it's your ticket"

**Delivery is SMS-first.** Email is where diaspora event tickets go to die. Twilio, sent on `payment_intent.succeeded`. Email is the backup copy, not the primary.

---

## 4. Organizer flow

### Onboarding
1. You create their account manually (v1 — no self-serve signup)
2. They complete Stripe Connect Express onboarding via a link you send — Stripe handles all KYC
3. Done

### Create event
A single form. The four vocabulary fields are dropdowns with no "other, please specify" escape hatch except the explicit `other` enum value. Flyer upload, tiers, capacity, on-sale time.

### Event dashboard
- Tickets sold / capacity, live
- Revenue, gross and net
- Sales by tier
- Sales over time (simple line — this is the lead-time curve they'll find genuinely useful)
- Guest list, searchable
- Comp ticket issue (generates a real ticket, marked `comp`)
- Payout status from Stripe

### Door mode (`/scan`)
The feature that wins you organizers.

- Opens in mobile browser, no app install
- Camera scans QR → green tick + name, or red X + reason (already used / wrong event / invalid)
- **Works offline** — caches the full guest list on load, queues scans, syncs when connection returns
- Live counter: checked in / total sold
- Multiple staff can scan simultaneously

Everyone's checkout works. Nobody's door works when the venue wifi dies. Build this properly and organizers will switch for it alone.

---

## 5. Messaging — organizers reach their attendees

The differentiator. Eventbrite hands organizers a CSV and washes its hands; the organizer then pastes 400 numbers into a group text. Owning this loop is what makes organizers stay, because the audience history lives in the account.

Two tiers. Same interface, completely different risk.

### 5a. Transactional broadcast — **v1**

Messaging *this event's* buyers about *this event*.

- Compose box on the event dashboard
- Recipients: all buyers for this event, or filtered by tier / checked-in / not-checked-in
- Channel: SMS, email, or both
- Send now or schedule
- Delivery status per recipient

Typical use: doors moved, venue changed, running late, parking instructions, "starts in 2 hours," "lost property at the desk."

No consent problem — they bought a ticket, they expect updates about it. This is the version that earns trust, and it's what organizers panic about at 6pm on show day.

### 5b. Marketing broadcast — **v1.5, after event 1**

Messaging past attendees about a *new* event.

- Audience builder: past attendees of this organizer, filterable by event_type, genre, city, last-attended date
- Templates, scheduling
- Per-organizer send history
- Unsubscribe handling

Same UI, entirely different legal footing. Do not ship this until §5d is fully in place.

### 5c. Schema

```
messages
  id
  organizer_id            → organizers.id
  event_id                → events.id, NULL for cross-event marketing
  kind                    ENUM: transactional | marketing
  channel                 ENUM: sms | email | both
  subject                 -- email only
  body
  recipient_filter        JSONB   -- the audience definition used
  status                  ENUM: draft | queued | sending | sent | failed
  scheduled_for
  sent_at
  recipient_count
  created_at
```

```
message_recipients
  id
  message_id              → messages.id
  buyer_id                → buyers.id
  channel                 ENUM: sms | email
  provider_message_id     -- Twilio SID / email provider ID
  status                  ENUM: queued | sent | delivered | failed | bounced | opted_out
  error
  delivered_at
```

```
consent_log
  id
  buyer_id                → buyers.id
  scope                   ENUM: hapnin | organizer_events
  channel                 ENUM: sms | email
  action                  ENUM: granted | revoked
  source                  ENUM: checkout | sms_stop | email_unsubscribe | admin
  event_id                -- where consent was captured
  ip_address
  user_agent
  consent_text            -- VERBATIM text shown at the moment of consent
  created_at
```

**Additions to `buyers`:**
```
  sms_marketing_opt_in    BOOLEAN
  email_marketing_opt_in  BOOLEAN
  sms_opted_out_at
  email_opted_out_at
```

`consent_log` is append-only — never update or delete a row. And `consent_text` stored **verbatim** is the single most important field in this section: a TCPA defense rests on proving exactly what the buyer agreed to, on what date, from what IP. Storing a reference to "the current checkout copy" is worthless the moment you edit that copy.

### 5d. Compliance — must be in place before any marketing send

**Consent scope.** Agreeing to hear from *Hapnin* is not agreeing to hear from *every organizer on Hapnin*. Checkout language must name the scope explicitly — something in the shape of "Hapnin and the organizers of events you attend." Statutory damages run $500–$1,500 **per message**; a single 400-person blast is meaningful exposure.

**A2P 10DLC registration.** US SMS requires brand and campaign registration through Twilio. Approval takes days to weeks. **Start this in week 1** — without it, transactional ticket delivery won't send either, and the whole end-of-month test fails on a paperwork queue.

**Sender separation.** Two Twilio Messaging Services, two 10DLC campaigns:
- **Service A — transactional:** ticket delivery, event updates
- **Service B — marketing:** organizer blasts

One organizer sending something spammy must not get the number carrying your tickets filtered. Same principle for email: separate sending subdomains (e.g. `tickets.` and `news.`) so DKIM reputation is isolated.

**STOP handling.** Every marketing SMS carries opt-out language. Inbound STOP writes a `consent_log` revocation and sets `sms_opted_out_at` immediately, before any further send job runs. Email carries a one-click unsubscribe header.

**Guardrails on organizer sends:**
- Max 1 marketing message per buyer, per organizer, per 7 days
- Quiet hours — no sends outside 10am–9pm local to the buyer's postal code (TCPA allows 8am–9pm; be stricter than required)
- Admin approval on each organizer's first marketing send
- Hard recipient cap per send until an organizer has a track record

---

## 6. Admin (yours only)

- **Buyer index** — search by phone/email, see full attendance history across all organizers
- **Repeat rate** — % of event N buyers who bought at any later event. Front and centre. This is the kill/continue metric.
- **Catchment map** — buyers plotted by zip code
- **Lead-time curve** — distribution of `days_before_event`, filterable by `event_type` and `genre`
- **Screening interest** — % yes, sliced by event type
- **CSV export** of everything, always

---

## 7. Money

**Stripe Connect, Express accounts. Destination charges.**

Funds settle to the organizer's own Stripe account; you take an `application_fee_amount`. Money never sits in your account.

This is not a preference. If ticket revenue lands in your balance and you remit it later, that's arguably money transmission, which is a state-by-state licensing problem that will end the business. Destination charges avoid it entirely.

**Fee structure for the test:** 0% platform fee, buyer pays Stripe processing. You're buying data and proof, not revenue. Revisit at event 3.

---

## 8. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | Next.js (App Router) on Vercel | One deploy, fast mobile, you know the ecosystem |
| Database | Postgres via Supabase | Enums, row-level security, auth included, generous free tier |
| Auth | Supabase Auth — organizers and admin only | Buyers never create accounts |
| Payments | Stripe Connect Express | See above |
| SMS | Twilio | WhatsApp Business API later, when volume justifies the approval process |
| File storage | Supabase Storage | Flyers |
| QR | `qrcode` to generate, `html5-qrcode` to scan | Both browser-side |
| Offline door | Service worker + IndexedDB | Cache guest list, queue scans |

**Domain:** `hapnin.now` → event pages at `/e/{slug}`, organizer dashboard at `/o`, door at `/scan`, admin at `/admin`.

---

## 9. Venue layouts

Worth thinking about properly, because "seat map" covers three very different products with wildly different costs.

### Tier 1 — General admission *(v1)*
No layout. A capacity number and tiers. This is most nightlife, most concerts, most community events. Ships now.

### Tier 2 — Zones and tables *(v1.5 — build this one)*
Named, finite inventory: "VIP Table 3, seats 8, $800." Balcony vs floor. Sponsor tables at a gala.

This is the tier that actually matters for your market. Owambe and gala culture is table-based — families and friend groups book a table together, and tables are the high-ticket item that carries the economics of the whole event. An organizer running a 300-person gala with 25 tables currently manages that in a WhatsApp thread and a paper diagram.

What it needs:
- Organizer defines zones once per venue, reusable across events
- Optional drag-to-position on a simple grid, rendered as SVG — but a plain list works and should be the fallback
- Buyer picks a table from a list or the grid; inventory decrements atomically
- Table booking generates N tickets (one per seat), which makes **ticket transfer (§10a) essential** — one person books eight seats and forwards seven

No map editor, no per-seat rendering. Zones plus a counter.

### Tier 3 — Assigned seating *(v2, and only when needed)*
Per-seat selection on a rendered map. Row H, seat 14.

You need this for one thing: **cinema screenings**. Which is exactly where the film side lands, so it will come — but it comes with Crossing, not with the events MVP.

When it does: **integrate, don't build.** A seat-map editor plus rendering plus hold/release logic plus accessibility handling is one of the most expensive features in ticketing software — months, not weeks. Seats.io and similar sell it per-ticket or monthly. Buy it the day a cinema partner signs, not before.

**Design rule for now:** keep `zone_id` on `ticket_tiers` from the start, even while every event is GA and every value is NULL. That single nullable column is what lets Tier 2 arrive as an addition rather than a migration.

---

## 10. Roadmap beyond the core

Staged, because the end-of-month test only survives if v1 stays small. Everything here is planned — the tier is when, not whether.

### 10a. v1 — ships with the first event

**Ticket transfer.** Buyers forward individual tickets by phone number; each recipient becomes a `buyer` row with their own consent capture.
*Why it's v1:* people buy in fours. As specced without this, you capture one buyer per four attendees — a 75% blind spot in the map, and a repeat-rate metric measuring the wrong population. A day of work that quadruples the asset.

**Organizer page — `/o/{handle}`.** Upcoming and past events for one organizer.
*Why it's v1:* nearly free (a query over components you already have), and it's what goes in their Instagram bio — which is how this actually spreads. Also gives you something to point at when approaching organizer three.

**Door sales.** "Sell at door" in the scanner: name, phone, zip, cash or card.
*Why it's v1:* walk-ups are normal at these events. Unrecorded, they leave a hole in attendance data in precisely the way that undermines the map.

**Waitlist / notify-me.** On sold-out tiers and before on-sale.
*Why it's v1:* captures demand signal *without* a transaction, and gives organizers evidence before they commit to a venue size — a concrete reason to keep using you.

### 10b. v1.5 — after the first event runs

- **Marketing broadcast** (§5b) with the full consent layer
- **Zones and table booking** (§9 Tier 2)
- **Post-event SMS**, 24 hours after: one question, one tap. Keeps the number warm; starts a qualitative layer the transaction data can't reach
- **Refund self-service** for organizers, within a policy window
- **Promo codes** — organizers ask for these constantly; simple percentage or fixed, capped by use count
- **Recurring / multi-date events** — one event record, multiple dates
- **Organizer self-serve signup** — only once you stop wanting to vet every organizer personally

### 10c. v2 — once the map is real

- **City discovery page** — browse what's on. Pointless with one organizer; valuable at fifteen
- **Assigned seating** via integration (§9 Tier 3)
- **Affiliate / promoter links** — per-promoter tracked links with commission. Big in this scene, and a genuine growth lever
- **Installments** — Klarna/Affirm via Stripe for higher-priced tables
- **Buyer accounts** — only when someone has enough ticket history to want them
- **Mobile app** — only when the web genuinely can't do something you need

### 10d. Still not on the roadmap

- Multi-currency and Nigerian payment rails — your buyers are in the US
- Anything on the film/distribution side — that's Crossing, and it doesn't start until the map produces a finding worth selling

---

## 11. Build order

**Week 1 — the spine**
**File A2P 10DLC registration on day 1** — it sits in an approval queue for days to weeks and blocks everything downstream. Then: schema + enums. Stripe Connect onboarding. Event creation form. Public event page rendering from the DB.

**Week 2 — the money**
Checkout with all capture fields, including consent capture into `consent_log`. Payment intent + destination charge. Webhook → create order + tickets. QR generation. SMS delivery. Confirmation page.

**Week 3 — the room**
Door scanner with offline caching. Door sales. Organizer dashboard + `/o/{handle}` page. Guest list. Comps. Transactional broadcast (§5a) — compose, filter, send, delivery status.

**Week 4 — the point**
Ticket transfer. Waitlist. Admin views. Repeat-rate calculation. CSV export. End-to-end test with a fake $1 event you buy tickets to yourself, on a real phone, in a room with bad signal.

---

## 12. Definition of done

The MVP is finished when you can, on a real phone:

1. Create an event with all four vocabulary fields set
2. Buy a ticket at a real price on mobile data
3. Receive the ticket by SMS
4. Scan it at the door **with airplane mode on**
5. Send a "doors open in 2 hours" broadcast to everyone who bought, and see delivery status per recipient
6. See the buyer appear in admin with zip code, lead time, opt-in status, and screening answer

Not when the design is finished. Not when the dashboard is pretty. When those five things work in sequence.
