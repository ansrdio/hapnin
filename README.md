# Hapnin — pre-launch landing page, organizer pitch, and the argument

Built with **Next.js (App Router) + TypeScript + Tailwind + Supabase**:

- **`/`** — the landing page. _Wetin dey hapnin?_ Two jobs: capture event-goers (phone + ZIP) and organizers (name, email, Instagram, city).
- **`/pitch`** — a direct-link **Instagram-Stories-style slideshow** sent to one organizer at a time. Offer-first: first event free, an interactive fee calculator (a dwell slide), and a lead form. **`/pitch/read`** is the same content as a plain scrolling page (cross-linked both ways).
- **`/why`** — a long-form, MDX-authored **argument** for investors, partners, and film-side contacts: the problem Hapnin exists to solve, with dated, cited demographic sources. A reading page, not a deck.

All three of `/pitch`, `/pitch/read`, and `/why` are **`noindex`** and disallowed in `robots.txt` — they're for direct DM links, not search — and each has its own deliberate OpenGraph card.

### Editing the `/why` argument

The essay is MDX at `app/why/page.mdx` — edit the prose without touching layout. Sources live in one registry (`app/why/sources.ts`); the `<Ref k="…" />` footnote markers and the `<References />` block read from it, so numbering stays in sync. Every figure is dated and characterized (ranges, never a competitor's exact rate). Update the `BUILD_DATE` in `app/why/components/References.tsx` when you refresh the figures.

## Stack notes

- **Fonts** are self-hosted from [Fontshare](https://fontshare.com): **Clash Display** (display) + **Supreme** (body). `.woff2` for the site live in `public/fonts`; `.ttf` copies in `assets/fonts` are only read server-side to render the generated OG image and favicon. No third-party font request at runtime.
- **Signups** are written server-side to **Cloud Firestore** via the Firebase Admin SDK (`lib/firestore.ts`, guarded by `server-only`). The service-account key is never shipped to the browser.
- **Spam protection**: a honeypot field on each form plus in-memory per-IP rate limiting (`lib/rate-limit.ts`).
- **Generated assets**: OpenGraph image (`app/opengraph-image.tsx`), favicon (`app/icon.tsx`), Apple icon (`app/apple-icon.tsx`), and `robots.txt` (`app/robots.ts`) — all produced at build/request time, nothing to hand-maintain.

## 1. Prerequisites

- Node 18.18+ (tested on Node 22)
- A Firebase project with **Cloud Firestore** enabled (free Spark tier is fine)

## 2. Environment variables

Copy the example and fill it in:

```bash
cp .env.local.example .env.local
```

Get the three Firebase values from **Firebase console → Project settings → Service accounts → Generate new private key** (downloads a JSON file):

| Variable | Where it's used | Notes |
|---|---|---|
| `FIREBASE_PROJECT_ID` | server | `project_id` from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | server only | `client_email` from the JSON |
| `FIREBASE_PRIVATE_KEY` | server only | **Secret.** `private_key` from the JSON, in quotes, keeping the `\n` escapes |
| `NEXT_PUBLIC_SITE_URL` | build | Public origin for canonical + OG URLs (e.g. `https://hapnin.now`) |

## 3. Firestore

No migrations — Firestore is schemaless. The server actions write to three collections, created on first write:

- `audience_signups` — landing-page audience (doc id = phone in E.164, so a number can't sign up twice).
- `organizer_signups` — landing-page organizer interest.
- `organizer_pitch_leads` — the `/pitch` lead form.

All writes go through the Admin SDK, which **bypasses security rules**, and no client ever touches Firestore. Deploy the deny-all client rules in `firestore.rules` so nothing is readable/writable from the browser:

```bash
firebase deploy --only firestore:rules
```

### Pitch lead notifications

The `/pitch` form just saves to `organizer_pitch_leads` — check the Firestore console (**Data**) for new leads. To get pinged on submit, implement `notifyNewPitchLead` in `lib/notify.ts` (it's already awaited by the action, and failures there never block the write): call Resend with a `RESEND_API_KEY` for email, or Twilio for SMS.

## 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Submitting a form writes a document; check the collections in the Firestore console.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project** → import the repo (framework auto-detects as Next.js).
3. Add the four environment variables from the table above under **Settings → Environment Variables** (Production + Preview). Set `NEXT_PUBLIC_SITE_URL` to your real domain. For `FIREBASE_PRIVATE_KEY`, paste the whole key including the `-----BEGIN/END-----` lines.
4. Deploy. Point `hapnin.now` at the project under **Settings → Domains**.

---

# Hapnin v1 — the ticketing product

The full product (spec: `hapnin-mvp-spec.md`) is built on the same app. It uses
**Firestore** (not the Postgres in `001_hapnin_schema.sql` — see
`docs/decisions/0001-firestore-over-postgres.md`). Read `docs/architecture.md` and
`docs/data-dictionary.md` first.

### Extra services to enable
- **Firebase Auth** → Email/Password provider with **Email link (passwordless)** on; add your domains (localhost, hapnin.now) under Authorized domains. Register a **Web app** to get the client config.
- **Firebase Storage** enabled (flyer uploads, Phase 2).
- **Stripe** with **Connect (Express)** — business model "You collect payments and pay recipients" (destination charges).
- **Twilio** account + number (optional until A2P 10DLC; `sendSMS()` logs to console until then).

### Env vars (add to `.env.local` and Vercel)
Firebase Admin (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`),
Firebase Web (`NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`),
Stripe (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`),
Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`),
Auth (`ADMIN_EMAILS` — comma-separated admin logins). See `.env.local.example`.

### Product routes
- **Admin** (auth, `ADMIN_EMAILS`): `/admin`, `/admin/organizers/{id}` — create organizers, run Stripe onboarding, send a test SMS.
- **Organizer** (auth): `/o` (dashboard lands Phase 2), `/scan` (Phase 1).
- **Buyer** (no auth): `/e/{slug}` (Phase 1), `/o/{handle}` (Phase 2).
- **API:** `/api/auth/session` (session cookie), `/api/stripe/webhook`.

### Stripe webhook (local)
`stripe listen --forward-to localhost:3000/api/stripe/webhook` → paste the `whsec_…`
into `STRIPE_WEBHOOK_SECRET`.

## Notes / next steps

- **Rate limiting is in-memory**, so on serverless it's per warm instance, not global — enough to blunt casual abuse of a signup form. For hard cross-instance limits, swap the `Map` in `lib/rate-limit.ts` for [Upstash Redis](https://upstash.com/) (the function signature stays the same).
- Phone numbers are validated as US NANP and stored as **E.164** (`+1XXXXXXXXXX`); ZIPs are stored as the 5-digit prefix.
- The design system (palette, type, motion) lives in `tailwind.config.ts` and `app/globals.css`.
- The `/pitch` fee calculator is fully client-side. The card-processing rate is one config object (`CARD`) at the top of `app/pitch/components/FeeCalculator.tsx` — update it there. The "typical platform" figure is a user-editable estimate, deliberately never a named competitor's rate.
