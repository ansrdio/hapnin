import "server-only";
import twilio from "twilio";
import { normalizeUsPhone } from "./validation";

// The single SMS chokepoint. Everything downstream (ticket delivery, broadcasts,
// invites) calls sendSMS() — so it all works in dev-mode console logging today
// and starts really sending the moment Twilio creds land (incl. A2P 10DLC), with
// no downstream change. Numbers are normalized to E.164 before sending.

type SendResult = { ok: boolean; sid?: string; mode: "twilio" | "console"; error?: string };

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (!client) client = twilio(sid, token);
  return client;
}

export async function sendSMS(opts: { to: string; body: string }): Promise<SendResult> {
  const to = normalizeUsPhone(opts.to);
  if (!to) return { ok: false, mode: "console", error: "invalid_phone" };

  const from = process.env.TWILIO_FROM_NUMBER;
  const tw = getClient();

  // Dev-mode fallback: no Twilio creds yet → log and succeed, so the full loop
  // is exercisable before A2P 10DLC approval.
  if (!tw || !from) {
    console.log(`[sendSMS · dev] → ${to}\n${opts.body}`);
    return { ok: true, mode: "console" };
  }

  try {
    const msg = await tw.messages.create({ to, from, body: opts.body });
    return { ok: true, sid: msg.sid, mode: "twilio" };
  } catch (err) {
    console.error("sendSMS twilio error", err);
    return { ok: false, mode: "twilio", error: (err as Error).message };
  }
}
