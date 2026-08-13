import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { sendSMS } from "./sms";

export const BROADCAST_MAX_LEN = 320;
const STOP_FOOTER = " Reply STOP to opt out.";

export type Recipient = { phone: string; first_name: string | null };

/**
 * The opted-in SMS audience for an event: distinct buyers who purchased a ticket
 * for it AND granted SMS marketing consent at checkout. Comp guests (no consent)
 * are excluded. Orders are queried by event_id alone (auto-indexed) and buyers
 * de-duped in memory.
 */
export async function getEventAudience(eventId: string): Promise<Recipient[]> {
  const db = getDb();
  const orders = await db.collection("orders").where("event_id", "==", eventId).get();
  const phones = [...new Set(orders.docs.map((d) => d.data().buyer_id as string).filter(Boolean))];
  if (phones.length === 0) return [];

  const refs = phones.map((p) => db.collection("buyers").doc(p));
  const snaps = await db.getAll(...refs);
  return snaps
    .filter((s) => s.exists && s.data()!.sms_marketing_opt_in === true)
    .map((s) => ({ phone: s.id, first_name: (s.data()!.first_name as string) ?? null }));
}

/**
 * Send an SMS broadcast to an event's opted-in audience. Records a `broadcasts`
 * doc for history, appends the STOP footer, and sends one message per recipient.
 * (Delivery is real only once Twilio creds are set; otherwise sendSMS logs.)
 */
export async function sendBroadcast(input: {
  eventId: string;
  organizerId: string;
  body: string;
}): Promise<{ recipients: number; sent: number; failed: number }> {
  const db = getDb();
  const audience = await getEventAudience(input.eventId);

  const body = input.body.trim().slice(0, BROADCAST_MAX_LEN) + STOP_FOOTER;

  const ref = db.collection("broadcasts").doc();
  await ref.set({
    event_id: input.eventId,
    organizer_id: input.organizerId,
    body,
    recipient_count: audience.length,
    status: "sending",
    created_at: FieldValue.serverTimestamp(),
  });

  let sent = 0;
  let failed = 0;
  for (const r of audience) {
    const res = await sendSMS({ to: r.phone, body });
    if (res.ok) sent++;
    else failed++;
  }

  await ref.update({ status: "sent", sent, failed, sent_at: FieldValue.serverTimestamp() });
  return { recipients: audience.length, sent, failed };
}
