# Account hardening & backups — do once, then quarterly

Status column: fill in the date when done. Everything here is dashboard work
that only the account owner can do; nothing in the codebase depends on it,
but every item is a way Hapnin could be taken over or lost outright.

## 1. Firestore backups (the only copy of every order and ticket)

Project: `hapnin-99c6b`. Run from a machine where `gcloud auth login` has been
done with the Google account that owns the Firebase project (the laptop's
gcloud is currently logged into a different account/project).

```bash
gcloud config set project hapnin-99c6b
```

Point-in-time recovery — 7 days of "undo" for a bad script or a wrong click:

```bash
gcloud firestore databases update --database='(default)' --enable-pitr
```

Daily export kept for 14 weeks (needs a bucket in the same project; the
export bucket must not be the flyer bucket):

```bash
gcloud storage buckets create gs://hapnin-99c6b-firestore-backups --location=us --uniform-bucket-level-access
```

```bash
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w
```

Confirm:

```bash
gcloud firestore backups schedules list --database='(default)'
```

Restore is `gcloud firestore databases restore --source-backup=… --destination-database=…`
into a *new* database, then point `FIREBASE_*` at it — never restore over the
live one while the site is up. Cost at today's size: cents per month.

| Item | Done |
|---|---|
| PITR enabled | |
| Daily backup schedule listed | |
| One test restore into a scratch database performed | |

## 2. Two-factor everywhere

Use a hardware key (two of them, one in a drawer) or an authenticator app.
SMS-only 2FA is not enough for the accounts marked ★ — a SIM swap takes them.

| Account | Why it matters | Minimum | Done |
|---|---|---|---|
| ★ Google account that owns Firebase / GCP | All data, service account, auth users | Hardware key; Advanced Protection if available | |
| ★ Stripe | Money, Connect accounts, webhooks | 2FA; owner + a finance-only user for payouts | |
| ★ Domain registrar (hapnin.now) | DNS for everything | 2FA; registrar lock; DNSSEC if offered | |
| ★ GitHub (ansrdio) | A push to main deploys | 2FA; branch protection on `main` (below) | |
| Vercel | Prod env vars, domains | 2FA; every secret marked Sensitive; review members | |
| Brevo | Sender reputation, every login link | 2FA; Authorized IPs stays OFF (Vercel egress rotates) | |
| Twilio | Texts and billing | 2FA; spending cap | |
| Apple Developer | Wallet pass cert, merchant domain | 2FA; cert expiry reminder | |
| Sentry | Error data (scrubbed, but still) | 2FA | |

## 3. Restricted Stripe key

The live secret key currently in Vercel is a full-access key. Replace it with a
restricted key so a leak can't, for example, list every customer or change
payout bank accounts.

Stripe → Developers → API keys → Create restricted key, permissions:

| Resource | Permission | Used by |
|---|---|---|
| PaymentIntents | Write | checkout create / cancel / retrieve |
| Refunds | Write | refunds |
| Balance | Read | admin earnings |
| Payouts | Read | organizer earnings |
| Events | Read | admin order-debug |
| Connect: Accounts | Write | organizer onboarding, login links |
| Connect: Account Links | Write | onboarding |
| Webhook Endpoints | None | (secret is separate) |

Everything else: None. Paste the new key straight into Vercel →
`STRIPE_SECRET_KEY` (Sensitive), redeploy, run one test refund from the admin
sample event, then roll the old full key in Stripe.

| Item | Done |
|---|---|
| Restricted key in Vercel | |
| Old key rolled | |
| Webhook endpoint: "email on failures" enabled | |
| Radar: default rules reviewed | |

## 4. GitHub branch protection

Settings → Branches → Add rule for `main`: require a pull request *or* at
minimum "require linear history" and "do not allow force pushes / deletions".
Once CI exists (P1), add "require status checks".

## 5. Vercel

- Every non-`NEXT_PUBLIC_` variable marked **Sensitive** (already the case for
  the secrets set so far; check the Sentry and Twilio ones when added).
- Deployment Protection → Preview deployments: Vercel Authentication ON, so
  preview URLs with real env can't be browsed by anyone with the link.
- Team members: only the people who need to deploy.

## 6. Break-glass

- Add a **second admin email** to `ADMIN_EMAILS` (a separate Google account
  with its own 2FA) so one lost mailbox can't lock you out.
- Write down, somewhere offline: where the Firebase service-account key was
  generated, who owns the Stripe account, the registrar login, and the
  hardware-key locations.

## Rotation schedule

| Secret | Rotate | How |
|---|---|---|
| `CRON_SECRET` | yearly or on suspicion | new value in Vercel → redeploy → curl with old must 401 |
| `STRIPE_WEBHOOK_SECRET` | on suspicion | Stripe → roll secret → Vercel |
| `STRIPE_SECRET_KEY` | on suspicion | create new restricted key → Vercel → roll old |
| `FIREBASE_PRIVATE_KEY` | yearly | new service-account key → Vercel → delete old key in GCP |
| `BREVO_API_KEY` | yearly | new key → Vercel → delete old |
| `QR_SECRET` | never casually | invalidates every issued ticket QR; only for a real leak, then re-email tickets |
