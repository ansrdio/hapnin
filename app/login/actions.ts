"use server";

import { headers } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { isAdminEmail } from "@/lib/auth";
import { getOrganizerByEmail } from "@/lib/organizers";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { normalizeEmail } from "@/lib/validation";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { LoginState } from "./action-state";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

/**
 * Send the passwordless sign-in link. When Brevo is configured we generate the
 * link server-side (Admin SDK) and send a branded email from our own domain —
 * better deliverability + branding. When it isn't, we return "fallback" so the
 * client sends via Firebase's built-in email (keeps login working meanwhile).
 *
 * To avoid leaking which emails have accounts, we only actually send to known
 * admins/organizers but always report "sent".
 */
export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { status: "error", message: "Enter a valid email address." };

  const h = await headers();
  const rl = rateLimit(`login:${clientIpFrom(h)}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  // No Brevo yet → let the client send via Firebase.
  if (!isEmailConfigured()) return { status: "fallback", email };

  const known = isAdminEmail(email) || !!(await getOrganizerByEmail(email));
  if (known) {
    try {
      const link = await getAdminAuth().generateSignInWithEmailLink(email, {
        url: `${siteUrl()}/login`,
        handleCodeInApp: true,
      });
      const sent = await sendEmail({
        to: email,
        subject: "Your Hapnin sign-in link",
        html: loginEmailHtml(link),
      });
      if (!sent.ok) return { status: "error", message: "Couldn’t send the link. Try again." };
    } catch (err) {
      console.error("sendLoginLink error", err);
      return { status: "error", message: "Couldn’t send the link. Try again." };
    }
  }
  return { status: "sent", email };
}

function loginEmailHtml(link: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#1B0A2A;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1B0A2A;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:440px;">
        <tr><td style="color:#F4B24C;font-size:13px;letter-spacing:3px;text-transform:uppercase;font-weight:600;padding-bottom:20px;">Hapnin</td></tr>
        <tr><td style="color:#F6EEE1;font-size:22px;font-weight:700;padding-bottom:8px;">Your sign-in link</td></tr>
        <tr><td style="color:#C9B2C4;font-size:15px;line-height:1.6;padding-bottom:24px;">Tap the button to sign in to Hapnin. No password needed. This link is one-time and expires shortly.</td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="${link}" style="display:inline-block;background:#F4B24C;color:#1B0A2A;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px;">Sign in to Hapnin</a>
        </td></tr>
        <tr><td style="color:#8f7d92;font-size:13px;line-height:1.6;">If you didn’t request this, you can ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
