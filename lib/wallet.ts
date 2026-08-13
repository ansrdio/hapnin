import "server-only";
import crypto from "crypto";
import forge from "node-forge";
import JSZip from "jszip";
import type { EventRecord } from "./events";
import type { TicketRecord } from "./orders";

// Apple Wallet (.pkpass) + Google Wallet (save JWT). Both stay dormant until the
// matching credentials are set — the ticket page only shows a button when the
// provider is configured. See docs for the exact env vars required.
//
// Apple:  APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_P12_BASE64,
//         APPLE_PASS_CERT_PASSWORD (optional), APPLE_WWDR_CERT_PEM
// Google: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_PRIVATE_KEY

export function isAppleWalletConfigured(): boolean {
  return !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_CERT_P12_BASE64 &&
    process.env.APPLE_WWDR_CERT_PEM
  );
}

export function isGoogleWalletConfigured(): boolean {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY
  );
}

// Minimal 1×1 PNG — a valid placeholder icon/logo. Real art comes in the design pass.
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64"
);

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fmtDate(ms: number, tz: string): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Google Wallet ────────────────────────────────────────────────────────────
export function googleSaveUrl(ticket: TicketRecord, event: EventRecord): string {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL!;
  const key = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const classId = `${issuerId}.hapnin_${event.id}`;
  const objectId = `${issuerId}.tkt_${ticket.id}`;

  const eventClass = {
    id: classId,
    issuerName: "Hapnin",
    reviewStatus: "UNDER_REVIEW",
    eventName: { defaultValue: { language: "en-US", value: event.title } },
    venue: {
      name: { defaultValue: { language: "en-US", value: event.venue_name } },
      address: { defaultValue: { language: "en-US", value: `${event.venue_address}, ${event.city}` } },
    },
  };
  const eventObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    barcode: { type: "QR_CODE", value: ticket.qr_token },
    hexBackgroundColor: "#1B0A2A",
  };

  const claims = {
    iss: saEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { eventTicketClasses: [eventClass], eventTicketObjects: [eventObject] },
  };
  const signingInput = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(key);
  return `https://pay.google.com/gp/v/save/${signingInput}.${b64url(signature)}`;
}

// ── Apple Wallet ─────────────────────────────────────────────────────────────
export async function applePkpass(ticket: TicketRecord, event: EventRecord): Promise<Buffer> {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID!;
  const teamId = process.env.APPLE_TEAM_ID!;
  const p12Base64 = process.env.APPLE_PASS_CERT_P12_BASE64!;
  const p12Password = process.env.APPLE_PASS_CERT_PASSWORD || "";
  const wwdrPem = process.env.APPLE_WWDR_CERT_PEM!.replace(/\\n/g, "\n");

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    serialNumber: ticket.id,
    organizationName: "Hapnin",
    description: `${event.title} ticket`,
    foregroundColor: "rgb(246,238,225)",
    backgroundColor: "rgb(27,10,42)",
    labelColor: "rgb(244,178,76)",
    barcodes: [{ format: "PKBarcodeFormatQR", message: ticket.qr_token, messageEncoding: "iso-8859-1" }],
    relevantDate: new Date(event.starts_at).toISOString(),
    eventTicket: {
      primaryFields: [{ key: "event", label: "EVENT", value: event.title }],
      secondaryFields: [
        { key: "date", label: "WHEN", value: fmtDate(event.starts_at, event.timezone) },
        { key: "venue", label: "WHERE", value: event.venue_name },
      ],
    },
  };

  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
    "icon.png": PLACEHOLDER_PNG,
    "icon@2x.png": PLACEHOLDER_PNG,
    "logo.png": PLACEHOLDER_PNG,
  };

  const manifest: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    manifest[name] = crypto.createHash("sha1").update(buf).digest("hex");
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest));

  // Detached PKCS#7 signature of manifest.json (pass cert + WWDR).
  const p12Der = forge.util.decode64(p12Base64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), p12Password);
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]![0];
  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]![0];
  const wwdr = forge.pki.certificateFromPem(wwdrPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuf.toString("binary"));
  p7.addCertificate(certBag.cert!);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: keyBag.key as forge.pki.rsa.PrivateKey,
    certificate: certBag.cert!,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });
  const signatureBuf = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");

  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file("manifest.json", manifestBuf);
  zip.file("signature", signatureBuf);
  return zip.generateAsync({ type: "nodebuffer" });
}
