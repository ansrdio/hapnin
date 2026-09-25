# Organizer demo — "The Sunday Table"

A polished sample event for organizer meetings (first use: a Phoenix women's-
brunch organizer). Built on the existing sample-event conventions
(`lib/sample.ts`) plus a simulated checkout that only works on `is_sample`
events. Code: `lib/demo.ts`, `app/admin/DemoPanel.tsx`, the demo branches in
`lib/checkout.ts`, `app/e/[slug]/page.tsx`, `app/e/[slug]/checkout/*`,
`app/t/[orderId]/page.tsx`.

## What it creates

| Thing | Value |
|---|---|
| Organizer | **Hapnin Demo Organizer**, handle `hapnin-demo`, owned by the admin email that clicks Create (so that login's `/o` is this dashboard) |
| Event | *The Sunday Table — A Women's Cultural Brunch*, draft, `is_sample`, capacity 60, the Sunday ~6 weeks out at 12:00 America/Phoenix, category Culture & Community, scene tag Pan-African, custom tags "Women's brunch" / "Sunday brunch", refund policy 7 days |
| Cover | `public/demo/sunday-table.png` (original illustration, no third-party rights), page tint `#c9712f` |
| Tiers | Early Bird $25 × 15 · General Admission $35 × 35 · Last Release $40 × 10 (no sales windows, so tickets show immediately) |
| Orders | 8 fictional guests (10 tickets): 3 Early Bird, 4 General, 1 Last Release; 4 orders (5 tickets) pre-checked-in. Names synthetic, emails `first.last@example.com`, phones 480-555-0100…0107, every opt-in off |
| Label | Description starts with "DEMO EVENT — For demonstration only. No actual event or admission."; the event page, checkout and ticket page each show a coral demo banner |

Fees are the real configured ones: Hapnin 3% + $0.50 per paid ticket, card
processing 2.9% + $0.30 shown to the buyer. Nothing was changed for the demo.

## Isolation (what can and cannot happen)

- The event is `draft` + `is_sample`: publishing is refused, it is never in
  Discover, the sitemap, lifecycle emails, the public organizer page or founder
  metrics; its page is `noindex`. It IS reachable by anyone with the URL —
  unlisted, not private (same as every draft).
- Checkout on a sample event skips wallets and cards entirely: the server
  prices the order like a real one, then fulfils it under a `sample_…` payment
  id. No Stripe object is created, no email or SMS is sent, no consent record is
  written; the order/tickets are `is_sample`. Refunding one voids tickets and
  never calls Stripe.
- A buyer typed into the demo checkout is flagged `is_sample` **only if the
  checkout created them**; an existing real buyer is untouched.
- Guest-list **Resend** on a sample event is a no-op (no mail to example.com).
- Broadcasts/announcements can't reach sample buyers (no opt-in).

## Create · reset · delete

`/admin` → **Organizer demo** panel (admin session required).

- **Create demo event** — idempotent; creates the organizer if needed.
- **Reset check-ins & simulated orders** — deletes every order made through
  the simulated checkout (and the buyer it created), restores the seeded
  check-in pattern, un-refunds seeded orders, recomputes counters. Run it
  after each walkthrough.
- **Delete demo event** — removes the event, tiers, orders, tickets and sample
  buyers. The organizer record stays (harmless; reuse it next time).

## Accounts for the meeting

- **Laptop (organizer view):** sign in at `/login` with the admin email. The
  session lands on `/admin`; open `/o` — the admin email owns Hapnin Demo
  Organizer, so that is its dashboard. (An owner account can only own one
  organizer, which is why the demo has its own.)
- **Phone (attendee view):** the event URL from the admin panel, signed out.

## 8-minute script

1. **(0:00) Phone — the event page.** Cover, date, venue, description with the
   program, three tiers with prices. Tap **Open in Maps** if she asks about
   directions.
2. **(1:00) Phone — Get tickets.** Pick General Admission ×2. The summary shows
   tickets, card processing and the total. Say out loud: "3% + 50¢ is our fee,
   card fees are shown to the buyer, she keeps the face value." Confirm the demo
   order (no card asked).
3. **(2:30) Phone — the ticket.** QR, Add to calendar, Open in Maps, transfer a
   ticket to a friend. Keep this screen open.
4. **(3:30) Laptop — Guests.** Her fictional guest list: names, tier, check-in
   state. The order you just made is at the top.
5. **(4:30) Laptop — Earnings.** Face value, Hapnin fee, net to her, by tier.
6. **(5:30) Laptop — Scanner.** Open `/scan/<eventId>`, allow the camera, scan
   the phone's QR: admitted. Scan again: "already used". Then **Door board**:
   the count moved.
7. **(7:00) Laptop — Guests → Check in** one seeded guest by hand; **Refund**
   one (voids, no Stripe). Mention broadcasts/announcements exist for reminders.
8. **(7:45) Close.** "Your next brunch: same page, your name, real money to your
   bank — connect Stripe once and it's live." Afterwards: `/admin` → **Reset**.

## Functional vs simulated

| Step | Status |
|---|---|
| Event page, tiers, fees, map, calendar, ticket page, QR | Functional |
| Guest list, earnings, analytics, door board, scanner, manual check-in, refund-void, transfer | Functional on sample data |
| Checkout payment | **Simulated** — priced for real, no card, no charge, no Stripe object |
| Ticket email / SMS | **Suppressed** on the demo (nothing is sent) |
| Publishing | Blocked by design (sample events never go on sale) |

## Known limitations

- No end time field exists; "3:00 p.m. — Close" lives in the description and
  the calendar file uses the default duration.
- The venue is a placeholder ("Sample venue — to be confirmed", Central
  Phoenix), so the map pin is approximate.
- The page is unlisted, not access-controlled.
- Stripe test mode is not configured for this environment (live keys only), so
  a card-entry demo is not possible without a real charge; hence the simulation.
