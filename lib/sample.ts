import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { createEvent, deleteEvent, getEventById, getTiers, listEventsByOrganizer, type EventRecord } from "./events";
import { qrToken } from "./qr";
import { computeAmounts } from "./checkout";

// A sample event with a realistic guest list, so a brand-new organizer can
// click through Guests, Earnings, the door board and the scanner with numbers
// on the screen instead of empty states. Everything it creates is flagged
// is_sample and lives only under this organizer; one click removes all of it.
//
// Sample buyers use 555 numbers (never real), no email, and every opt-in off,
// so nothing can ever text or email them. Sample orders carry a "sample_"
// payment id (never touches Stripe; refunds of them just void tickets) and
// are excluded from founder metrics and the organizer's audience.

const NAMES: [string, string][] = [
  ["Ada", "Okafor"], ["Chidi", "Nwosu"], ["Tolu", "Adeyemi"], ["Kwame", "Mensah"], ["Amara", "Eze"],
  ["Femi", "Balogun"], ["Ngozi", "Obi"], ["Kofi", "Boateng"], ["Zainab", "Bello"], ["Emeka", "Okonkwo"],
  ["Yemi", "Alade"], ["Thandiwe", "Dlamini"], ["Sipho", "Ndlovu"], ["Fatima", "Diallo"], ["Kemi", "Ogunleye"],
  ["Tunde", "Bakare"], ["Abena", "Owusu"], ["Ifeoma", "Chukwu"],
];

/** Next Saturday at 9pm Phoenix (UTC-7), at least 5 days out. */
function nextSaturdayNight(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5, 4, 0)); // 21:00 MST = 04:00 UTC next day
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1); // Sat 21:00 MST is Sun 04:00 UTC
  return d.getTime();
}

export async function getSampleEvent(organizerId: string): Promise<EventRecord | null> {
  const events = await listEventsByOrganizer(organizerId);
  return events.find((e) => e.is_sample) ?? null;
}

export async function createSampleEvent(input: { organizerId: string; handle: string }): Promise<{ id: string }> {
  const existing = await getSampleEvent(input.organizerId);
  if (existing) return { id: existing.id };

  const db = getDb();
  const startsAt = nextSaturdayNight();
  const event = await createEvent({
    organizer_id: input.organizerId,
    title: "Sample: Afrobeats Night",
    slug: `sample-${input.handle}-${Math.random().toString(36).slice(2, 6)}`,
    description:
      "This is a sample event with made-up guests so you can see how a real night looks in Hapnin — guest list, earnings, the door board, the scanner. Delete it whenever you like.",
    venue_name: "The Sample Room",
    venue_address: "123 Demo St",
    city: "Phoenix",
    state: "AZ",
    starts_at: startsAt,
    doors_at: startsAt - 60 * 60 * 1000,
    status: "draft",
    capacity: 300,
    refund_policy: "none",
    referral_off_cents: 500,
    event_type: "nightlife",
    community: "nigerian",
    primary_language: "mixed",
    genre: "afrobeats",
    talent: ["DJ Sample", "MC Demo"],
    is_sample: true,
    tiers: [
      { name: "Early Bird", price_cents: 1500, quantity_total: 75, sales_start_at: null, sales_end_at: null },
      { name: "General", price_cents: 2500, quantity_total: 175, sales_start_at: null, sales_end_at: null },
      { name: "VIP", price_cents: 4500, quantity_total: 50, sales_start_at: null, sales_end_at: null },
    ],
  });
  const tiers = await getTiers(event.id);
  const byName = (n: string) => tiers.find((t) => t.name === n)!;

  // 18 orders across the tiers, bought over the last ten days; the first 6
  // already "checked in" so the door board and scanner have something to show.
  const plan: { tier: string; qty: number }[] = [
    ...Array.from({ length: 6 }, () => ({ tier: "Early Bird", qty: 1 })),
    ...Array.from({ length: 8 }, () => ({ tier: "General", qty: 1 })),
    { tier: "General", qty: 2 }, { tier: "General", qty: 2 },
    { tier: "VIP", qty: 1 }, { tier: "VIP", qty: 2 },
  ];

  const batch = db.batch();
  const now = Date.now();
  const sold = new Map<string, number>();
  let ticketsSold = 0;
  let gross = 0;
  let checkedIn = 0;

  plan.forEach((p, i) => {
    const [first, last] = NAMES[i % NAMES.length];
    const phone = `+1555010${String(1000 + i).slice(-4)}`;
    const tier = byName(p.tier);
    const amounts = computeAmounts(tier.price_cents, p.qty, false);
    const createdAt = now - (10 - Math.min(9, i * 0.55)) * 86_400_000;
    const orderRef = db.collection("orders").doc();

    batch.set(db.collection("buyers").doc(phone), {
      phone,
      email: null,
      first_name: first,
      last_name: last,
      postal_code: "85004",
      screening_interest: null,
      show_name: true,
      sms_marketing_opt_in: false,
      email_marketing_opt_in: false,
      is_sample: true,
      first_event_id: event.id,
      created_at: Timestamp.fromMillis(createdAt),
    });
    batch.set(orderRef, {
      event_id: event.id,
      buyer_id: phone,
      tier_id: tier.id,
      quantity: p.qty,
      subtotal_cents: amounts.subtotal_cents,
      discount_cents: 0,
      fee_cents: amounts.application_fee_cents,
      total_cents: amounts.total_cents,
      stripe_payment_intent_id: `sample_${orderRef.id}`,
      status: "paid",
      channel: "online",
      is_sample: true,
      promo_code_id: null,
      ref_code: Math.random().toString(36).slice(2, 10),
      referred_by_order_id: null,
      days_before_event: Math.max(0, Math.ceil((startsAt - createdAt) / 86_400_000)),
      referral_source: ["instagram", "friend", "whatsapp", null][i % 4],
      promoter_link_id: null,
      created_at: Timestamp.fromMillis(createdAt),
    });
    for (let k = 0; k < p.qty; k++) {
      const tRef = db.collection("tickets").doc();
      const checkIn = i < 6;
      if (checkIn) checkedIn++;
      batch.set(tRef, {
        order_id: orderRef.id,
        event_id: event.id,
        buyer_id: phone,
        qr_token: qrToken(tRef.id),
        is_comp: false,
        is_sample: true,
        checked_in_at: checkIn ? Timestamp.fromMillis(now - (6 - i) * 4 * 60_000) : null,
        checked_in_by: checkIn ? input.organizerId : null,
        created_at: Timestamp.fromMillis(createdAt),
      });
    }
    sold.set(tier.id, (sold.get(tier.id) ?? 0) + p.qty);
    ticketsSold += p.qty;
    gross += amounts.subtotal_cents;
  });

  for (const [tierId, n] of sold) {
    batch.update(db.collection("events").doc(event.id).collection("tiers").doc(tierId), { quantity_sold: n });
  }
  batch.update(db.collection("events").doc(event.id), {
    tickets_sold: ticketsSold,
    gross_cents: gross,
    checked_in: checkedIn,
  });
  await batch.commit();
  return { id: event.id };
}

/** Remove the sample event and everything seeded with it. Only ever touches is_sample data. */
export async function deleteSampleEvent(eventId: string, organizerId: string): Promise<boolean> {
  const db = getDb();
  const event = await getEventById(eventId);
  if (!event || !event.is_sample || event.organizer_id !== organizerId) return false;

  const [tickets, orders] = await Promise.all([
    db.collection("tickets").where("event_id", "==", eventId).get(),
    db.collection("orders").where("event_id", "==", eventId).get(),
  ]);
  const phones = new Set<string>();
  const batch = db.batch();
  tickets.docs.forEach((t) => batch.delete(t.ref));
  orders.docs.forEach((o) => {
    if (o.data().buyer_id) phones.add(o.data().buyer_id);
    batch.delete(o.ref);
  });
  await batch.commit();

  // Sample buyers only — a real buyer who somehow shares a number is untouched.
  if (phones.size) {
    const snaps = await db.getAll(...[...phones].map((p) => db.collection("buyers").doc(p)));
    const b2 = db.batch();
    snaps.forEach((s) => {
      if (s.exists && s.data()!.is_sample === true) b2.delete(s.ref);
    });
    await b2.commit();
  }
  await deleteEvent(eventId);
  return true;
}
