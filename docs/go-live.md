# Go-live checklist

Moving Hapnin from test/sandbox to real money + real texts. Work top to bottom;
each Vercel env change needs a **redeploy** to take effect.

## 1. Stripe — switch to LIVE mode
Test and live are separate worlds; nothing carries over.

1. Stripe Dashboard → toggle to **Live mode** → **Developers → API keys**:
   - `STRIPE_SECRET_KEY` = `sk_live_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
2. Create a **live webhook** (Developers → Webhooks → Add endpoint):
   - URL `https://www.hapnin.now/api/stripe/webhook`, scope **Your account**
   - events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `account.updated`
   - copy its signing secret → `STRIPE_WEBHOOK_SECRET` = `whsec_…`
   - (Or send me the live secret key and I'll create it via API, like we did in test.)
3. **Connected accounts don't transfer.** Any organizer who onboarded in test has a
   test `stripe_account_id` that's invalid under live keys. For a clean launch,
   onboard **fresh** organizers in live. To reuse a test organizer, clear their
   `stripe_account_id` + `stripe_onboarded` in Firestore so they re-connect.
4. Redeploy. Then each organizer clicks **Connect payouts** on their dashboard and
   completes real Stripe onboarding (bank details, identity).

## 2. Twilio — real SMS
Ticket links, broadcasts, and waitlist texts only *log* until this is set.

1. Create a Twilio account, buy a US number (or a **Messaging Service**).
2. **Register A2P 10DLC** (US carrier requirement for app-to-person SMS) — a brand +
   campaign registration inside Twilio. Sending at scale without it gets filtered.
3. Set in Vercel:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
   - **either** `TWILIO_MESSAGING_SERVICE_SID` (recommended) **or** `TWILIO_FROM_NUMBER`
4. Redeploy. `sendSMS()` starts delivering automatically — no code change.
5. (Recommended before marketing texts: wire **STOP** auto-unsubscribe — not built yet.)

## 3. Email — login/signup deliverability (Brevo)
Sign-in links must land in inboxes, not spam.

1. In Brevo, **verify your sending domain** (add the SPF, DKIM, DMARC DNS records).
2. `BREVO_SENDER_EMAIL` = an address on that verified domain (e.g. `hey@hapnin.now`);
   `BREVO_SENDER_NAME` = `Hapnin`. Confirm `BREVO_API_KEY` is set.
3. Send yourself a login link and confirm inbox delivery.

## 4. Turn off the dev seed
- The `/api/dev/seed` route is now disabled unless `ALLOW_DEV_SEED=1` is set.
- **For testing:** add `ALLOW_DEV_SEED=1` in Vercel to keep seeding.
- **For launch:** remove `ALLOW_DEV_SEED` (or set to `0`) so the route 404s.

## 5. Final checks
- `NEXT_PUBLIC_SITE_URL` = `https://hapnin.now`.
- Do one **real** end-to-end: a live card purchase (small amount, then refund),
  confirm the ticket text arrives and the payout shows on the organizer's Stripe.
- Consider Stripe's live-mode radar/fraud rules and a real support email.
