import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { sendSMS, isSmsConfigured } from "./sms";
import { sendBroadcastEmail } from "./email";
import { getEventById } from "./events";
import { getOrganizerById } from "./organizers";
import { getOrCreateUnsubToken } from "./buyers";

export const BROADCAST_MAX_LEN = 1000; // email body; SMS gets an SMS-safe cut
const SMS_MAX = 300;
const STOP_FOOTER = " Reply STOP to opt out.";

export type Recipient = {
  phone: string;
  first_name: string | null;
  email: string | null;
  sms: boolean; // opted into SMS
  emailOk: boolean; // opted into email AND has an address
};

export type AudienceSummary = { total: number; email: number; sms: number };

/**
 * The opted-in audience for an event: distinct buyers holding a PAID ticket for
 * it who consented to updates on at least one channel. Refunded orders and comp
 * guests (no consent) are excluded. Orders are queried by event_id alone
 * (auto-indexed) and buyers de-duped in memory.
 */
export async function getEventAudience(eventId: string): Promise<Recipient[]> {
  const db = getDb();
  const orders = await db.collection("orders").where("event_id", "==", eventId).get();
  const phones = [
    ...new Set(
      orders.docs
        .filter((d) => d.data().status === "paid")
        .map((d) => d.data().buyer_id as string)
        .filter(Boolean)
    ),
  ];
  if (phones.length === 0) return [];

  const refs = phones.map((p) => db.collection("buyers").doc(p));
  const snaps = await db.getAll(...refs);
  const out: Recipient[] = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const d = s.data()!;
    const email = (d.email as string | null) ?? null;
    const sms = d.sms_marketing_opt_in === true;
    const emailOk = d.email_marketing_opt_in === true && !!email;
    if (!sms && !emailOk) continue;
    out.push({ phone: s.id, first_name: (d.first_name as string) ?? null, email, sms, emailOk });
  }
  return out;
}

/** Counts for the form: how many will get an email, how many a text. */
export async function audienceSummary(eventId: string): Promise<AudienceSummary> {
  const a = await getEventAudience(eventId);
  return { total: a.length, email: a.filter((r) => r.emailOk).length, sms: a.filter((r) => r.sms).length };
}

export type BroadcastResult = {
  recipients: number;
  email: { sent: number; failed: number };
  sms: { sent: number; failed: number; skipped: number };
};

/**
 * Send a broadcast to an event's opted-in audience. Email goes out now (Brevo
 * is live) with a per-buyer unsubscribe link; SMS goes out only once Twilio is
 * configured — otherwise it is counted as *skipped*, never silently "sent".
 * Records a `broadcasts` doc for history.
 */
export async function sendBroadcast(input: {
  eventId: string;
  organizerId: string;
  body: string;
  subject?: string | null;
}): Promise<BroadcastResult> {
  const db = getDb();
  const [event, organizer, audience] = await Promise.all([
    getEventById(input.eventId),
    getOrganizerById(input.organizerId),
    getEventAudience(input.eventId),
  ]);
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const eventUrl = `${site}/e/${event.slug}`;
  const organizerName = organizer?.name ?? "Your organizer";
  const body = input.body.replace(/\r/g, "").trim().slice(0, BROADCAST_MAX_LEN);
  const subject = (input.subject ?? "").trim().slice(0, 120) || `${organizerName}: ${event.title}`;
  const smsOn = isSmsConfigured();
  const smsBody =
    (body.length <= SMS_MAX ? body : `${body.slice(0, SMS_MAX - 24).trimEnd()}… More: ${eventUrl}`) + STOP_FOOTER;

  const ref = db.collection("broadcasts").doc();
  await ref.set({
    event_id: input.eventId,
    organizer_id: input.organizerId,
    subject,
    body,
    channels: { email: true, sms: smsOn },
    recipient_count: audience.length,
    status: "sending",
    created_at: FieldValue.serverTimestamp(),
  });

  const result: BroadcastResult = { recipients: audience.length, email: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0, skipped: 0 } };
  for (const r of audience) {
    if (r.emailOk && r.email) {
      try {
        const token = await getOrCreateUnsubToken(r.phone);
        const res = await sendBroadcastEmail({
          to: r.email,
          firstName: r.first_name,
          organizerName,
          eventTitle: event.title,
          subject,
          body,
          eventUrl,
          unsubscribeUrl: `${site}/unsubscribe/${token ?? "unknown"}`,
        });
        if (res.ok) result.email.sent++;
        else result.email.failed++;
      } catch (err) {
        result.email.failed++;
        console.error("broadcast email error", { phone: r.phone }, err);
      }
    }
    if (r.sms) {
      if (!smsOn) {
        result.sms.skipped++;
      } else {
        const res = await sendSMS({ to: r.phone, body: smsBody });
        if (res.ok) result.sms.sent++;
        else result.sms.failed++;
      }
    }
  }

  await ref.update({
    status: "sent",
    email_sent: result.email.sent,
    email_failed: result.email.failed,
    sms_sent: result.sms.sent,
    sms_failed: result.sms.failed,
    sms_skipped: result.sms.skipped,
    sent_at: FieldValue.serverTimestamp(),
  });
  return result;
}

export type BroadcastRecord = {
  id: string;
  subject: string;
  body: string;
  created_at: number;
  recipient_count: number;
  email_sent: number;
  sms_sent: number;
  sms_skipped: number;
};

/** Most recent broadcasts for an event, newest first. Single-field query; sorted in memory. */
export async function listBroadcasts(eventId: string, max = 5): Promise<BroadcastRecord[]> {
  const snap = await getDb().collection("broadcasts").where("event_id", "==", eventId).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      const ts = x.created_at as { toMillis?: () => number } | undefined;
      return {
        id: d.id,
        subject: (x.subject as string) ?? "",
        body: (x.body as string) ?? "",
        created_at: ts?.toMillis ? ts.toMillis() : 0,
        recipient_count: x.recipient_count ?? 0,
        email_sent: x.email_sent ?? 0,
        sms_sent: x.sms_sent ?? 0,
        sms_skipped: x.sms_skipped ?? 0,
      };
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, max);
}
