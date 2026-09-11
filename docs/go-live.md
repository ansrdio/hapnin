# Go-live checklist

Status as of **2026-09-09**. Real money has moved end to end in production
(card + Apple Pay purchases, ticket email, refund). Each Vercel env change
needs a **redeploy** to take effect.

## ✅ Done — verified with live transactions

### Stripe (LIVE)
- Dedicated **Hapnin** Stripe account (`acct_1UDYjUJiGJhulN5H`). The old shared
  "Philists" account was restricted and is not used.
- Connect **platform profile** completed: destination charges, Stripe-hosted
  Express onboarding, platform liable for refunds/chargebacks.
- Vercel Production: `STRIPE_SECRET_KEY` (`sk_live_…`),
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`), `STRIPE_WEBHOOK_SECRET`.
- Live webhook → `https://www.hapnin.now/api/stripe/webhook`, events:
  `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `payment_intent.canceled`, `account.updated`.
- **Apple Pay / Google Pay / Link** at checkout (Express Checkout Element).
  Apple verifies the exact hostname: `www.hapnin.now` is registered under
  Settings → Payment method domains, and the association file is served at
  `public/.well-known/apple-developer-merchantid-domain-association`.
- Money model: buyer pays face value + card processing; the organizer's own
  connected account is the settlement merchant (`on_behalf_of`); Hapnin's
  `application_fee` (3% + 50¢; **$0 while an organizer's launch-offer waiver
  is active** — `organizers.fee_waived_until`, set by admin) is the only thing
  that lands on the platform. The old per-event "first event free" flag is no
  longer honoured (2026-09-10). Free ($0) tickets skip Stripe entirely.

### Email (Brevo)
- `hapnin.now` authenticated (brevo-code TXT, DKIM, DMARC). Sender
  `tickets@hapnin.now` / `Hapnin`. `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
  `BREVO_SENDER_NAME` set.
- **Keep Brevo's "Authorized IPs" DEACTIVATED for API keys** — Vercel's rotating
  IPs can't be allowlisted; when it was on, every send silently fell back to
  Firebase's unbranded email.
- Emails in use: sign-in link, ticket (purchase, comp, resend), refund notice.

### Payment robustness
- `payment_failed` is **retryable** — the hold is kept; only `canceled` releases.
- A released hold whose payment then succeeds is re-reserved and fulfilled.
- `/api/order-status` reconciles against Stripe on read, so a lost or late
  webhook can't strand a paid buyer.
- Hold release, fulfilment, and refund each **claim state in one transaction**
  (no double-release, no duplicate orders, no double refunds).
- Abandoned holds are swept (Stripe-reconciled) before every new reservation
  and via `/api/cron/sweep-holds`.

## ⏳ Pending — safe to launch without, gated in the UI

### Twilio — real SMS
Until this is set, `sendSMS()` only logs. The product is honest about it:
the broadcast form shows "Texting isn't switched on yet"; tickets, comps,
resend, and refunds all go by **email**. Nothing in the UI changes when
Twilio lands — the gate lifts itself.

1. Twilio account + a **Messaging Service** (recommended) or a US number.
2. **Register A2P 10DLC** (brand + campaign). Takes days; sending at scale
   without it gets filtered.
3. Vercel: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either
   `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`. Redeploy.
4. Before marketing texts: wire STOP auto-unsubscribe (not built yet).

### Daily cron — lifecycle emails + sweeper (one env var to switch on)
`vercel.json` schedules two **daily** jobs (daily is allowed on Hobby as well as Pro):
- `/api/cron/lifecycle` at 16:00 UTC (9am Phoenix) — ticket-holder reminders
  the day before ("Tomorrow: …") and the day of ("Tonight: …"), and a
  thank-you to opted-in buyers the morning after (skipped if the organizer
  already sent a post-event message). Each stage is claimed once per event
  in `lifecycle_sends`, so retries can't double-send.
- `/api/cron/sweep-holds` at 15:00 UTC — backstop sweep of abandoned holds.

**Status: ON** — `CRON_SECRET` set in Vercel → Production 2026-09-10 (rotated once
the same day) and verified: dry runs of both routes return 200 JSON with the
secret, 307 without. Vercel sends it as `Authorization: Bearer …`. Preview what
the next run would do, as admin or with the secret: `/api/cron/lifecycle?dry=1`.
To rotate: `openssl rand -hex 32` → edit the var → redeploy; the old value is
rejected as soon as the redeploy finishes.

## 🔧 Admin ops tools (admin session required — `ADMIN_EMAILS`)
| Route | Use |
|---|---|
| `/admin` | organizers list, create organizer |
| `/api/admin/recount?eventId=…` (`&apply=1` to write) | recompute tier/event counters from paid orders + live holds; repairs drift |
| `/api/admin/order-debug?pi=pi_…` | for a paid-but-missing order: Stripe status/metadata, event sequence, whether our webhook saw each, pending-order state |
| `/api/cron/sweep-holds` | run a full abandoned-hold sweep on demand |

Removed for launch: `/api/dev/seed`, `/api/dev/email-check`, `/api/dev/purge-org`.
`ALLOW_DEV_SEED` can be deleted from Vercel.

## Accounts & access
- **Admin** = emails in `ADMIN_EMAILS` (comma-separated). Currently
  `filanabolaji@gmail.com`. Adding one needs a redeploy.
- **Organizer** dashboards are matched by the organizer's own login email —
  the live org `/o/abolajifilani` signs in as `abolaji.filani@ansrd.io`.
  The admin email is not an organizer; add it as a team member if one login
  for both is wanted.
- Test organizers (`aura`, `done`, `philists`) and all seeded data were purged
  2026-09-09. Only `/o/abolajifilani` remains.

## Env summary (Vercel · Production)
`NEXT_PUBLIC_SITE_URL=https://hapnin.now` · `ADMIN_EMAILS` ·
`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` ·
`STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` ·
`BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` ·
`CRON_SECRET` (set, verified) · pending: `TWILIO_*`.

## Legal pages
- `/terms` and `/privacy` are live, linked from the landing footer, beside the
  checkout consent line, and in the sitemap. Both read from `lib/legal.ts`:
  operator name (`LEGAL_NAME`, currently the trade name "Hapnin" — swap in the
  LLC name if one exists), support email (`jii@hapnin.now`), governing state
  (Arizona), and the fee text (mirrors `lib/checkout.ts`).
- **Terms publish the platform fee** (3% + $0.50 per paid ticket; free tickets
  carry no fee) — terms must disclose fees.
- They are careful plain-language drafts, **not legal advice** — have a lawyer
  review before scale.

## Before opening to the public
- **Monitor `jii@hapnin.now`** — it is now the public support/contact address on
  the legal pages and the landing footer.
- Keep a small **platform balance** in Stripe (or enable bank debit for
  negative balances): refunds are paid from the platform balance and Stripe
  keeps its processing fee, so a $0 balance refuses refunds.
- Review Stripe **Radar** rules for live mode; set a real support email.
- Times are Phoenix-only (`America/Phoenix`, no DST) — fine for launch,
  generalize before events outside Arizona.
