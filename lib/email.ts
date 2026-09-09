import "server-only";

// Transactional email via Brevo. One chokepoint like sendSMS. Falls back to a
// console log if BREVO_API_KEY isn't set, so nothing downstream breaks before
// the domain is authenticated.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export function isEmailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string; mode: "brevo" | "console" }> {
  const key = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "login@hapnin.now";
  const senderName = process.env.BREVO_SENDER_NAME || "Hapnin";

  if (!key) {
    console.log(`[email · dev] → ${opts.to}: ${opts.subject}`);
    return { ok: true, mode: "console" };
  }

  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: opts.to, name: opts.toName }],
        subject: opts.subject,
        htmlContent: opts.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("brevo send error", res.status, body);
      return { ok: false, error: `brevo_${res.status}`, mode: "brevo" };
    }
    return { ok: true, mode: "brevo" };
  } catch (err) {
    console.error("email send error", err);
    return { ok: false, error: (err as Error).message, mode: "brevo" };
  }
}

/** Buyer's ticket confirmation email — links to the QR ticket page. */
export async function sendTicketEmail(opts: {
  to: string;
  firstName?: string;
  eventTitle: string;
  whenText: string;
  venue: string;
  quantity: number;
  ticketUrl: string;
}): Promise<{ ok: boolean; error?: string; mode: "brevo" | "console" }> {
  const hi = opts.firstName ? `Hi ${escapeHtml(opts.firstName)},` : "You're in.";
  const plural = opts.quantity > 1 ? `${opts.quantity} tickets` : "your ticket";
  const html = `
  <div style="background:#1B0A2A;padding:32px 16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#F6EEE1">
    <div style="max-width:480px;margin:0 auto;background:#2C1342;border-radius:16px;padding:28px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#F4B24C">Your ticket</p>
      <h1 style="margin:0 0 16px;font-size:26px;color:#F6EEE1">${escapeHtml(opts.eventTitle)}</h1>
      <p style="margin:0 0 2px;color:#C9B8D8">${escapeHtml(opts.whenText)}</p>
      <p style="margin:0 0 20px;color:#C9B8D8">${escapeHtml(opts.venue)}</p>
      <p style="margin:0 0 20px;color:#F6EEE1">${hi} We've got ${plural}. Tap below to open your QR code at the door.</p>
      <a href="${opts.ticketUrl}" style="display:inline-block;background:#F4B24C;color:#1B0A2A;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px">View your ticket</a>
      <p style="margin:20px 0 0;font-size:13px;color:#9A87AC">Or paste this link: <br>${escapeHtml(opts.ticketUrl)}</p>
    </div>
    <p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#9A87AC;text-align:center">Hapnin · events for the culture</p>
  </div>`;
  return sendEmail({
    to: opts.to,
    toName: opts.firstName,
    subject: `Your ticket — ${opts.eventTitle}`,
    html,
  });
}

/** Buyer's refund notice — sent after the Stripe refund succeeds. */
export async function sendRefundEmail(opts: {
  to: string;
  firstName?: string | null;
  eventTitle: string;
  amountCents: number;
}): Promise<{ ok: boolean; error?: string; mode: "brevo" | "console" }> {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  const hi = opts.firstName ? `Hi ${escapeHtml(opts.firstName)},` : "Hi,";
  const html = `
  <div style="background:#1B0A2A;padding:32px 16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#F6EEE1">
    <div style="max-width:480px;margin:0 auto;background:#2C1342;border-radius:16px;padding:28px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#F4B24C">Refund issued</p>
      <h1 style="margin:0 0 16px;font-size:26px;color:#F6EEE1">${escapeHtml(opts.eventTitle)}</h1>
      <p style="margin:0 0 12px;color:#F6EEE1">${hi} we've refunded <strong>${amount}</strong> for your ticket.</p>
      <p style="margin:0 0 12px;color:#C9B8D8">It goes back to the card you paid with. Banks usually post it within 5–10 business days.</p>
      <p style="margin:0;color:#C9B8D8">Your ticket for this event is no longer valid.</p>
    </div>
    <p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#9A87AC;text-align:center">Hapnin · events for the culture</p>
  </div>`;
  return sendEmail({
    to: opts.to,
    toName: opts.firstName ?? undefined,
    subject: `Refund issued — ${opts.eventTitle}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
