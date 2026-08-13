# Wallet passes (Apple & Google)

The plumbing is built (`lib/wallet.ts`, `/api/wallet/apple/[ticketId]`,
`/api/wallet/google/[ticketId]`). The "Add to Apple Wallet" / "Save to Google
Wallet" buttons on `/t/{orderId}` appear **only when the matching env vars are
set** — until then the feature is dormant and nothing breaks.

Passes are bearer-authorized by the ticket id (same trust model as the QR link).

## Apple Wallet — env vars
Requires an Apple Developer account ($99/yr).

1. In the Apple Developer portal → Identifiers → create a **Pass Type ID**
   (e.g. `pass.now.hapnin.ticket`).
2. Generate a **pass certificate** for it, download it, and export from Keychain
   as a **.p12**.
3. Download **Apple's WWDR certificate** (G4) as PEM.

Set:
- `APPLE_PASS_TYPE_ID` — e.g. `pass.now.hapnin.ticket`
- `APPLE_TEAM_ID` — your 10-char Apple Team ID
- `APPLE_PASS_CERT_P12_BASE64` — the .p12 file, base64-encoded (`base64 -i cert.p12`)
- `APPLE_PASS_CERT_PASSWORD` — the .p12 export password (omit if none)
- `APPLE_WWDR_CERT_PEM` — the WWDR cert PEM (newlines as literal `\n`, like the Firebase key)

## Google Wallet — env vars
Requires a Google Cloud project + Google Wallet API access.

1. Enable the **Google Wallet API**, request an **Issuer ID** in the Google Pay &
   Wallet Console.
2. Create a **service account**, grant it Wallet Object Issuer, download a JSON key.

Set:
- `GOOGLE_WALLET_ISSUER_ID` — your numeric issuer id
- `GOOGLE_WALLET_SA_EMAIL` — the service account email (`client_email` in the JSON)
- `GOOGLE_WALLET_SA_PRIVATE_KEY` — the `private_key` from the JSON (literal `\n` newlines)

## Notes
- The pass icon/logo is a 1×1 placeholder for now — real artwork lands in the design pass.
- Add these in Vercel (Production) and redeploy; the buttons light up automatically.
