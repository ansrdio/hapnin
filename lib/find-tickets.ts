import "server-only";
import { getDb } from "./firebase-admin";
import { getEventById, type EventRecord } from "./events";
import { sendMyTicketsEmail } from "./email";

// "Find my tickets": a buyer gives the email or phone they bought with, and we
// EMAIL them their upcoming ticket links. Nothing is ever shown on-page to an
// anonymous visitor, and the caller learns nothing — so this can't be used to
// enumerate buyers. Phone-only buyers with no email on file get nothing (SMS is
// gated until Twilio); the page copy says as much.

const UPCOMING_GRACE_MS = 6 * 60 * 60 * 1000; // still "upcoming" for 6h after doors

function fmtWhen(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz,
  }).format(new Date(ms));
}

export async function emailMyTickets(input: { email: string | null; phone: string | null }): Promise<void> {
  const db = getDb();

  let buyer: FirebaseFirestore.DocumentSnapshot | null = null;
  if (input.phone) {
    const s = await db.collection("buyers").doc(input.phone).get();
    if (s.exists) buyer = s;
  }
  if (!buyer && input.email) {
    const q = await db.collection("buyers").where("email", "==", input.email).limit(1).get();
    if (!q.empty) buyer = q.docs[0];
  }
  if (!buyer) return;

  const b = buyer.data()!;
  const to = (b.email as string | null) ?? null; // only ever the address on file
  if (!to) return;

  const orders = await db.collection("orders").where("buyer_id", "==", buyer.id).get();
  const now = Date.now();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const eventCache = new Map<string, EventRecord | null>();

  const items: { startsAt: number; eventTitle: string; whenText: string; venue: string; quantity: number; ticketUrl: string }[] = [];
  for (const d of orders.docs) {
    const o = d.data();
    if (o.status !== "paid") continue;
    let ev = eventCache.get(o.event_id);
    if (ev === undefined) {
      ev = await getEventById(o.event_id);
      eventCache.set(o.event_id, ev);
    }
    if (!ev || ev.starts_at + UPCOMING_GRACE_MS < now) continue;
    items.push({
      startsAt: ev.starts_at,
      eventTitle: ev.title,
      whenText: fmtWhen(ev.starts_at, ev.timezone),
      venue: [ev.venue_name, ev.city].filter(Boolean).join(", "),
      quantity: o.quantity ?? 1,
      ticketUrl: `${site}/t/${d.id}`,
    });
  }
  items.sort((a, b) => a.startsAt - b.startsAt);

  await sendMyTicketsEmail({ to, firstName: (b.first_name as string) ?? null, items });
}
