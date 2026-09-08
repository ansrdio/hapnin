import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Admin-only Brevo diagnostic: reports whether the env is present and does a real
// send via Brevo, returning the exact API response so we can see why login email
// falls back to Firebase. Remove before launch.
export async function GET() {
  const user = await requireAdmin();
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME;

  const config = {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) : null,
    senderEmail: senderEmail ?? null,
    senderName: senderName ?? null,
  };

  if (!apiKey || !senderEmail) {
    return NextResponse.json({ config, sent: false, reason: "missing_env — set BREVO_API_KEY / BREVO_SENDER_EMAIL for Production" });
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName || "Hapnin" },
        to: [{ email: user.email }],
        subject: "Hapnin · Brevo test",
        htmlContent: "<p>If you got this from tickets@hapnin.now, Brevo is working.</p>",
      }),
    });
    const body = await res.text();
    return NextResponse.json({ config, sent: res.ok, status: res.status, brevoResponse: body.slice(0, 600) });
  } catch (err) {
    return NextResponse.json({ config, sent: false, error: (err as Error).message });
  }
}
