import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { getOrganizerByHandle } from "@/lib/organizers";
import { createEvent, createTable, getTiers } from "@/lib/events";
import { qrToken } from "@/lib/qr";

export const runtime = "nodejs";

// DEV SEED — admin only. Creates one rich, realistic test event (lineup, tiers,
// tables, buyers, orders, tickets, some checked in) so every buyer/organizer page
// has data to walk. Visit /api/dev/seed?handle=aura while signed in as admin.
// Remove this route before real launch.

const NAMES = [
  ["Ada", "Okafor"], ["Kwame", "Mensah"], ["Chidi", "Eze"], ["Amara", "Nwosu"],
  ["Kofi", "Boateng"], ["Ngozi", "Ibe"], ["Tunde", "Bello"], ["Efua", "Asante"],
  ["Emeka", "Obi"], ["Yaa", "Owusu"], ["Sade", "Adeyemi"], ["Zola", "Nkosi"],
  ["Femi", "Balogun"], ["Abena", "Darko"], ["Uche", "Okonkwo"], ["Kojo", "Antwi"],
  ["Ifeoma", "Nwankwo"], ["Ama", "Serwaa"],
];

export async function GET(req: Request) {
  await requireAdmin();
  const handle = new URL(req.url).searchParams.get("handle") || "aura";
  const organizer = await getOrganizerByHandle(handle);
  if (!organizer) return NextResponse.json({ error: `No organizer @${handle}. Pass ?handle=your-handle.` }, { status: 404 });

  const db = getDb();
  const stamp = Date.now().toString(36);
  const slug = `amapiano-sundays-${stamp}`;
  const startsAt = Date.now() + 12 * 86_400_000; // ~12 days out

  const event = await createEvent({
    organizer_id: organizer.id,
    title: "Amapiano Sundays",
    slug,
    description:
      "The log-drum takes over. Sunday reset with the sound of the moment — amapiano, afrobeats, and a little alté to close. Doors 8pm. 21+.",
    flyer_url: `https://picsum.photos/seed/amapiano${stamp}/900/1200`,
    venue_name: "The Van Buren",
    venue_address: "401 W Van Buren St",
    city: "Phoenix",
    state: "AZ",
    starts_at: startsAt,
    status: "on_sale",
    capacity: 290,
    event_type: "music",
    community: "pan_african",
    primary_language: "english",
    genre: "amapiano",
    talent: ["Uncle Waffles", "Major League DJz", "DBN Gogo", "Kabza De Small", "Focalistic"],
    is_first_event: false,
    tiers: [
      { name: "Early Bird", price_cents: 1500, quantity_total: 50 },
      { name: "General", price_cents: 2500, quantity_total: 200 },
      { name: "VIP", price_cents: 6000, quantity_total: 40 },
    ],
  });

  await createTable(event.id, { name: "Booth 1", seats: 8, price_cents: 50000 });
  await createTable(event.id, { name: "Booth 2", seats: 10, price_cents: 80000 });

  const tiers = await getTiers(event.id);
  const general = tiers.find((t) => t.name === "General")!;
  const vip = tiers.find((t) => t.name === "VIP")!;
  const earlyBird = tiers.find((t) => t.name === "Early Bird")!;

  // 18 real orders: 14 General + 4 VIP, one ticket each; 6 checked in.
  let tickets = 0;
  let gross = 0;
  let checkedIn = 0;
  const daysBefore = Math.max(0, Math.ceil((startsAt - Date.now()) / 86_400_000));

  for (let i = 0; i < 18; i++) {
    const [first, last] = NAMES[i];
    const isVip = i >= 14;
    const tier = isVip ? vip : general;
    const phone = `+16025550${String(100 + i)}`;

    await db.collection("buyers").doc(phone).set({
      phone, first_name: first, last_name: last, email: `${first.toLowerCase()}@example.com`,
      postal_code: "85004", sms_marketing_opt_in: true, email_marketing_opt_in: true,
      first_event_id: event.id, created_at: FieldValue.serverTimestamp(),
    });

    const orderRef = db.collection("orders").doc();
    await orderRef.set({
      event_id: event.id, buyer_id: phone, tier_id: tier.id, quantity: 1,
      subtotal_cents: tier.price_cents, discount_cents: 0, fee_cents: 0, total_cents: tier.price_cents,
      stripe_payment_intent_id: `pi_seed_${stamp}_${i}`, status: "paid", channel: "online",
      promoter_link_id: null, promo_code_id: null,
      referral_source: ["instagram", "whatsapp", "friend", "flyer"][i % 4],
      days_before_event: daysBefore, created_at: FieldValue.serverTimestamp(),
    });

    const doCheckIn = i < 6;
    const tRef = db.collection("tickets").doc();
    await tRef.set({
      order_id: orderRef.id, event_id: event.id, buyer_id: phone, qr_token: qrToken(tRef.id),
      is_comp: false, checked_in_at: doCheckIn ? FieldValue.serverTimestamp() : null,
      checked_in_by: doCheckIn ? organizer.id : null, created_at: FieldValue.serverTimestamp(),
    });

    tickets += 1;
    gross += tier.price_cents;
    if (doCheckIn) checkedIn += 1;
  }

  // Tier sold counts (Early Bird sold out to show the state) + event counters.
  await db.collection("events").doc(event.id).collection("tiers").doc(general.id).update({ quantity_sold: 14 });
  await db.collection("events").doc(event.id).collection("tiers").doc(vip.id).update({ quantity_sold: 4 });
  await db.collection("events").doc(event.id).collection("tiers").doc(earlyBird.id).update({ quantity_sold: 50 });
  await db.collection("events").doc(event.id).update({
    tickets_sold: tickets + 50, // + the sold-out Early Bird allocation
    gross_cents: gross,
    checked_in: checkedIn,
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  return NextResponse.json({
    ok: true,
    event: `${site}/e/${slug}`,
    manage: `${site}/o/events/${event.id}`,
    guests: `${site}/o/events/${event.id}/guests`,
    analytics: `${site}/o/events/${event.id}/analytics`,
    organizerPage: `${site}/o/${organizer.handle}`,
    note: "Tables are unsold (try buying one). Early Bird shows sold out. 6 of 18 checked in.",
  });
}
