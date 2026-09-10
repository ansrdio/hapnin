import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEventById } from "./events";
import { sendSMS, isSmsConfigured } from "./sms";
import { sendWaitlistEmail } from "./email";

// Waitlist for a sold-out event. One entry per phone (id = `${eventId}:${phone}`).
// Entries may carry an email — the reliable channel until Twilio lands. The list
// is notified automatically when a refund frees a seat on a full tier, and by the
// organizer's "Notify waitlist" button; each person hears at most once per 24h.

const COLL = "waitlist_entries";
const MIN_GAP_MS = 24 * 60 * 60 * 1000;

export type WaitlistEntry = {
  id: string;
  event_id: string;
  phone: string;
  email: string | null;
  name: string | null;
  quantity: number;
  notified_at: number | null;
};

export async function joinWaitlist(input: {
  eventId: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  quantity: number;
}): Promise<void> {
  const qty = Math.max(1, Math.min(8, Math.floor(input.quantity)));
  await getDb().collection(COLL).doc(`${input.eventId}:${input.phone}`).set(
    {
      event_id: input.eventId,
      phone: input.phone,
      email: input.email ?? null,
      name: input.name ?? null,
      quantity: qty,
      notified_at: null,
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export type WaitlistSummary = { total: number; withEmail: number };

export async function waitlistSummary(eventId: string): Promise<WaitlistSummary> {
  const snap = await getDb().collection(COLL).where("event_id", "==", eventId).get();
  return { total: snap.size, withEmail: snap.docs.filter((d) => !!d.data().email).length };
}

export async function waitlistCount(eventId: string): Promise<number> {
  return (await waitlistSummary(eventId)).total;
}

export type NotifyResult = { emailed: number; texted: number; skipped: number };

/**
 * Tell the waitlist tickets are back: email where we have one, SMS where
 * consented and Twilio is configured. Anyone notified within the last 24h is
 * skipped, so several refunds in a row don't spam. Marks notified_at.
 */
export async function notifyWaitlist(eventId: string): Promise<NotifyResult> {
  const db = getDb();
  const event = await getEventById(eventId);
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const snap = await db.collection(COLL).where("event_id", "==", eventId).get();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const eventUrl = `${site}/e/${event.slug}`;
  const whenText = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone,
  }).format(new Date(event.starts_at));
  const smsOn = isSmsConfigured();
  const now = Date.now();

  const result: NotifyResult = { emailed: 0, texted: 0, skipped: 0 };
  for (const doc of snap.docs) {
    const d = doc.data();
    const last = (d.notified_at as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
    if (now - last < MIN_GAP_MS) {
      result.skipped++;
      continue;
    }
    let reached = false;
    if (d.email) {
      const r = await sendWaitlistEmail({ to: d.email, name: d.name ?? null, eventTitle: event.title, whenText, eventUrl });
      if (r.ok) {
        result.emailed++;
        reached = true;
      }
    }
    if (d.phone && smsOn) {
      const r = await sendSMS({ to: d.phone, body: `Tickets just opened for ${event.title}: ${eventUrl}` });
      if (r.ok) {
        result.texted++;
        reached = true;
      }
    }
    if (reached) await doc.ref.update({ notified_at: FieldValue.serverTimestamp() });
    else result.skipped++;
  }
  return result;
}
