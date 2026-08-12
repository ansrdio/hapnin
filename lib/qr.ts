import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed QR tokens. The QR encodes the ticket id plus an HMAC signature — never
// a sequential id — so a scanner can verify authenticity offline (with the same
// secret) and forged/guessed ids are rejected. Format: base64url(id).base64url(sig)

function secret(): string {
  const s = process.env.QR_SECRET;
  if (!s) throw new Error("Missing QR_SECRET.");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(ticketId: string): string {
  return b64url(createHmac("sha256", secret()).update(ticketId).digest());
}

/** Build the QR token for a ticket id. */
export function qrToken(ticketId: string): string {
  return `${b64url(Buffer.from(ticketId))}.${sign(ticketId)}`;
}

/** Verify a scanned token. Returns the ticket id if the signature is valid, else null. */
export function verifyQrToken(token: string): string | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  let ticketId: string;
  try {
    ticketId = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(ticketId);
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return ticketId;
}
