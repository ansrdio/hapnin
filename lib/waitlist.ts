import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEventById } from "./events";
import { sendSMS } from "./sms";

// Waitlist for a sold-out event. One entry per phone (id = `${eventId}:${phone}`).
// When inventory frees up the organizer texts the list a buy link.

const COLL = "waitlist_entries";

export type WaitlistEntry = {
  id: string;
  event_id: string;
  phone: string;
  name: string | null;
  quantity: number;
  notified_at: number | null;
};

export async function joinWaitlist(input: {
  eventId: string;
  phone: string;
  name?: string | null;
  quantity: number;
}): Promise<void> {
  const qty = Math.max(1, Math.min(8, Math.floor(input.quantity)));
  await getDb().collection(COLL).doc(`${input.eventId}:${input.phone}`).set(
    {
      event_id: input.eventId,
      phone: input.phone,
      name: input.name ?? null,
      quantity: qty,
      notified_at: null,
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function waitlistCount(eventId: string): Promise<number> {
  const snap = await getDb().collection(COLL).where("event_id", "==", eventId).get();
  return snap.size;
}

/** Text everyone on the waitlist a buy link and mark them notified. */
export async function notifyWaitlist(eventId: string): Promise<{ notified: number }> {
  const db = getDb();
  const event = await getEventById(eventId);
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const snap = await db.collection(COLL).where("event_id", "==", eventId).get();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

  let notified = 0;
  for (const doc of snap.docs) {
    const res = await sendSMS({
      to: doc.data().phone,
      body: `Tickets just opened for ${event.title}: ${site}/e/${event.slug}`,
    });
    if (res.ok) {
      notified++;
      await doc.ref.update({ notified_at: FieldValue.serverTimestamp() });
    }
  }
  return { notified };
}
