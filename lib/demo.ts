import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { createEvent, getEventById, getTiers, listEventsByOrganizer, type EventRecord } from "./events";
import { createOrganizer, getOrganizerById, type Organizer } from "./organizers";
import { qrToken } from "./qr";
import { computeAmounts } from "./checkout";
import { deleteSampleEvent } from "./sample";

// A polished demo event for organizer meetings — "The Sunday Table", a women's
// cultural brunch — under its own organizer ("Hapnin Demo Organizer"). Built
// on the same conventions as lib/sample.ts so every existing safeguard applies:
//   • the event is is_sample → can never be published, never in Discover /
//     sitemap / lifecycle emails / founder metrics; its page is unlisted +
//     noindex and its checkout is a labelled simulation (lib/checkout.ts)
//   • orders / tickets / buyers are is_sample; payment ids are "sample_…"
//     (never Stripe; refunds just void); buyers have example.com addresses,
//     555 numbers and every opt-in off, so nothing can ever email or text them
//   • seeded rows carry demo_seed so a reset can restore the exact starting
//     state after a walkthrough (and drop any simulated orders made during it)
// Created, reset and deleted only from /admin.

export const DEMO_HANDLE = "hapnin-demo";
export const DEMO_ORGANIZER_NAME = "Hapnin Demo Organizer";
export const DEMO_LABEL = "DEMO EVENT — For demonstration only. No actual event or admission.";

const DESCRIPTION = `${DEMO_LABEL}

An afternoon of good food, meaningful conversations and cultural connection for women in Phoenix. Come with a friend or arrive on your own and meet someone new. Enjoy a relaxed brunch, a guided conversation and time to connect with women across our community.

Program
12:00 p.m. — Arrival and introductions
12:30 p.m. — Brunch and conversation starters
1:15 p.m. — Guided discussion: Friendship, ambition and finding community
2:00 p.m. — Open conversation and connections
3:00 p.m. — Close`;

// Eight fictional guests. Names are synthetic; addresses are on the reserved
// example.com domain; numbers are in the fictional 555-01xx range.
const GUESTS: { first: string; last: string; tier: string; qty: number; checkedIn: boolean }[] = [
  { first: "Adaeze", last: "Okafor", tier: "Early Bird", qty: 1, checkedIn: true },
  { first: "Thandiwe", last: "Dlamini", tier: "Early Bird", qty: 2, checkedIn: true },
  { first: "Maya", last: "Rivera", tier: "Early Bird", qty: 1, checkedIn: false },
  { first: "Zainab", last: "Bello", tier: "General Admission", qty: 1, checkedIn: true },
  { first: "Priya", last: "Nair", tier: "General Admission", qty: 2, checkedIn: false },
  { first: "Abena", last: "Owusu", tier: "General Admission", qty: 1, checkedIn: true },
  { first: "Ifeoma", last: "Chukwu", tier: "General Admission", qty: 1, checkedIn: false },
  { first: "Fatima", last: "Diallo", tier: "Last Release", qty: 1, checkedIn: false },
];

/** A Sunday about six weeks out, 12:00 America/Phoenix (UTC-7, no DST). */
export function demoBrunchStart(now = Date.now()): number {
  const d = new Date(now + 42 * 86_400_000);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 19, 0)); // 12:00 MST = 19:00 UTC
  while (day.getUTCDay() !== 0) day.setUTCDate(day.getUTCDate() + 1);
  return day.getTime();
}

export async function getDemoOrganizer(): Promise<Organizer | null> {
  const h = await getDb().collection("handles").doc(DEMO_HANDLE).get();
  if (!h.exists) return null;
  return getOrganizerById(h.data()!.organizer_id);
}

/** The demo organizer's sample event, if it exists. */
export async function getDemoEvent(): Promise<EventRecord | null> {
  const org = await getDemoOrganizer();
  if (!org) return null;
  const events = await listEventsByOrganizer(org.id);
  return events.find((e) => e.is_sample) ?? null;
}

/**
 * Create the demo organizer (owned by `ownerEmail`, so that login reaches its
 * dashboard) and The Sunday Table event with eight seeded orders. Idempotent:
 * returns the existing event if there is one.
 */
export async function createDemoBrunch(input: { ownerEmail: string; site: string }): Promise<{ organizer: Organizer; event: EventRecord; created: boolean }> {
  let organizer = await getDemoOrganizer();
  if (!organizer) {
    organizer = await createOrganizer({
      name: DEMO_ORGANIZER_NAME,
      handle: DEMO_HANDLE,
      email: input.ownerEmail,
      phone: "+14805550100",
      signup_source: "demo",
    });
  }
  const existing = (await listEventsByOrganizer(organizer.id)).find((e) => e.is_sample);
  if (existing) return { organizer, event: existing, created: false };

  const db = getDb();
  const startsAt = demoBrunchStart();
  const event = await createEvent({
    organizer_id: organizer.id,
    title: "The Sunday Table — A Women’s Cultural Brunch",
    slug: `demo-sunday-table-${Math.random().toString(36).slice(2, 6)}`,
    description: DESCRIPTION,
    flyer_url: `${input.site}/demo/sunday-table.png`,
    flyer_color: "#c9712f",
    venue_name: "Sample venue — to be confirmed",
    venue_address: "Central Phoenix",
    city: "Phoenix",
    state: "AZ",
    starts_at: startsAt,
    doors_at: startsAt,
    timezone: "America/Phoenix",
    status: "draft",
    capacity: 60,
    refund_policy: "7day",
    referral_off_cents: 0,
    category: "culture",
    scene_tags: ["pan_african"],
    custom_tags: ["Women’s brunch", "Sunday brunch"],
    primary_language: null,
    talent: [],
    is_sample: true,
    tiers: [
      { name: "Early Bird", price_cents: 2500, quantity_total: 15, sales_start_at: null, sales_end_at: null },
      { name: "General Admission", price_cents: 3500, quantity_total: 35, sales_start_at: null, sales_end_at: null },
      { name: "Last Release", price_cents: 4000, quantity_total: 10, sales_start_at: null, sales_end_at: null },
    ],
  });
  const tiers = await getTiers(event.id);
  const byName = (n: string) => tiers.find((t) => t.name === n)!;

  const batch = db.batch();
  const now = Date.now();
  const sold = new Map<string, number>();
  let ticketsSold = 0;
  let gross = 0;
  let checkedIn = 0;

  GUESTS.forEach((g, i) => {
    const phone = `+1480555${String(100 + i).padStart(4, "0")}`; // 480-555-0100…0107
    const email = `${g.first}.${g.last}@example.com`.toLowerCase();
    const tier = byName(g.tier);
    const amounts = computeAmounts(tier.price_cents, g.qty, false);
    const createdAt = now - (12 - i * 1.3) * 86_400_000;
    const orderRef = db.collection("orders").doc();

    batch.set(db.collection("buyers").doc(phone), {
      phone,
      email,
      first_name: g.first,
      last_name: g.last,
      postal_code: "85004",
      screening_interest: null,
      show_name: true,
      sms_marketing_opt_in: false,
      email_marketing_opt_in: false,
      is_sample: true,
      demo_seed: true,
      first_event_id: event.id,
      created_at: Timestamp.fromMillis(createdAt),
    });
    batch.set(orderRef, {
      event_id: event.id,
      buyer_id: phone,
      tier_id: tier.id,
      quantity: g.qty,
      subtotal_cents: amounts.subtotal_cents,
      discount_cents: 0,
      fee_cents: amounts.application_fee_cents,
      total_cents: amounts.total_cents,
      stripe_payment_intent_id: `sample_${orderRef.id}`,
      status: "paid",
      channel: "online",
      is_sample: true,
      demo_seed: true,
      promo_code_id: null,
      ref_code: Math.random().toString(36).slice(2, 10),
      referred_by_order_id: null,
      days_before_event: Math.max(0, Math.ceil((startsAt - createdAt) / 86_400_000)),
      referral_source: ["instagram", "friend", "whatsapp", null][i % 4],
      promoter_link_id: null,
      created_at: Timestamp.fromMillis(createdAt),
    });
    for (let k = 0; k < g.qty; k++) {
      const tRef = db.collection("tickets").doc();
      if (g.checkedIn) checkedIn++;
      batch.set(tRef, {
        order_id: orderRef.id,
        event_id: event.id,
        buyer_id: phone,
        qr_token: qrToken(tRef.id),
        is_comp: false,
        is_sample: true,
        demo_seed: true,
        demo_seed_checked_in: g.checkedIn,
        checked_in_at: g.checkedIn ? Timestamp.fromMillis(now - (8 - i) * 3 * 60_000) : null,
        checked_in_by: g.checkedIn ? organizer.id : null,
        created_at: Timestamp.fromMillis(createdAt),
      });
    }
    sold.set(tier.id, (sold.get(tier.id) ?? 0) + g.qty);
    ticketsSold += g.qty;
    gross += amounts.subtotal_cents;
  });

  for (const [tierId, n] of sold) {
    batch.update(db.collection("events").doc(event.id).collection("tiers").doc(tierId), { quantity_sold: n });
  }
  batch.update(db.collection("events").doc(event.id), { tickets_sold: ticketsSold, gross_cents: gross, checked_in: checkedIn });
  await batch.commit();

  const fresh = await getEventById(event.id);
  return { organizer, event: fresh ?? event, created: true };
}

/**
 * Put the demo back to its starting state after a walkthrough: seeded
 * check-ins restored (checked-in guests back in, the rest back out), every
 * order made through the simulated checkout removed (and the buyer it created,
 * if that checkout created one), counters recomputed.
 */
export async function resetDemoBrunch(eventId: string): Promise<{ removedOrders: number; ticketsSold: number; checkedIn: number } | null> {
  const db = getDb();
  const event = await getEventById(eventId);
  if (!event || !event.is_sample) return null;

  const [tickets, orders] = await Promise.all([
    db.collection("tickets").where("event_id", "==", eventId).get(),
    db.collection("orders").where("event_id", "==", eventId).get(),
  ]);

  const batch = db.batch();
  const phonesToDrop = new Set<string>();
  let removedOrders = 0;
  orders.docs.forEach((o) => {
    if (o.data().demo_seed === true) return;
    removedOrders++;
    if (o.data().buyer_id) phonesToDrop.add(o.data().buyer_id);
    batch.delete(o.ref);
  });

  const soldByTier = new Map<string, number>();
  let ticketsSold = 0;
  let checkedIn = 0;
  const now = Date.now();
  tickets.docs.forEach((t, i) => {
    const d = t.data();
    if (d.demo_seed !== true) {
      batch.delete(t.ref);
      return;
    }
    const inn = d.demo_seed_checked_in === true;
    batch.update(t.ref, {
      checked_in_at: inn ? Timestamp.fromMillis(now - (tickets.size - i) * 3 * 60_000) : null,
      checked_in_by: inn ? event.organizer_id : null,
      checked_in_offline: false,
      voided_at: null,
    });
    if (inn) checkedIn++;
    ticketsSold++;
  });
  // Seeded orders may have been refunded during a demo: restore them to paid.
  orders.docs.forEach((o) => {
    const d = o.data();
    if (d.demo_seed !== true) return;
    if (d.status !== "paid") batch.update(o.ref, { status: "paid", refunded_at: null });
    soldByTier.set(d.tier_id, (soldByTier.get(d.tier_id) ?? 0) + (d.quantity ?? 0));
  });
  const tiers = await getTiers(eventId);
  let gross = 0;
  for (const t of tiers) {
    batch.update(db.collection("events").doc(eventId).collection("tiers").doc(t.id), { quantity_sold: soldByTier.get(t.id) ?? 0 });
    gross += (soldByTier.get(t.id) ?? 0) * t.price_cents;
  }
  batch.update(db.collection("events").doc(eventId), { tickets_sold: ticketsSold, gross_cents: gross, checked_in: checkedIn });
  await batch.commit();

  // Buyers created by simulated checkouts (flagged is_sample at creation, not seeded).
  if (phonesToDrop.size) {
    const snaps = await db.getAll(...[...phonesToDrop].map((p) => db.collection("buyers").doc(p)));
    const b2 = db.batch();
    snaps.forEach((s) => {
      const d = s.exists ? s.data()! : null;
      if (d && d.is_sample === true && d.demo_seed !== true) b2.delete(s.ref);
    });
    await b2.commit();
  }
  return { removedOrders, ticketsSold, checkedIn };
}

/** Remove the demo event and everything seeded or simulated under it. The organizer record stays. */
export async function deleteDemoBrunch(eventId: string): Promise<boolean> {
  const event = await getEventById(eventId);
  if (!event || !event.is_sample) return false;
  return deleteSampleEvent(eventId, event.organizer_id);
}
