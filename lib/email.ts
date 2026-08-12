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
