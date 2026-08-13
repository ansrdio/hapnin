import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";

// Promoter / affiliate links. Each is a shareable code (?p=code) that attributes
// sales to a promoter for an event and tracks their running totals. commission
// is per-order and used only for reporting what the organizer owes the promoter —
// Hapnin does not move money to promoters (that would need their own Connect
// account). doc id = `${eventId}:${code}`.

const COLL = "promoter_links";

export type PromoterLink = {
  id: string;
  event_id: string;
  organizer_id: string;
  code: string;
  name: string;
  commission_cents: number;
  orders_count: number;
  tickets_count: number;
  gross_cents: number;
};

function toLink(id: string, d: FirebaseFirestore.DocumentData): PromoterLink {
  return {
    id,
    event_id: d.event_id,
    organizer_id: d.organizer_id,
    code: d.code,
    name: d.name,
    commission_cents: d.commission_cents ?? 0,
    orders_count: d.orders_count ?? 0,
    tickets_count: d.tickets_count ?? 0,
    gross_cents: d.gross_cents ?? 0,
  };
}

function slugCode(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
  return base || "promo";
}

/** Create a promoter link with a unique code derived from the name. */
export async function createPromoterLink(input: {
  eventId: string;
  organizerId: string;
  name: string;
  commissionCents: number;
}): Promise<PromoterLink> {
  const db = getDb();
  const base = slugCode(input.name);
  // Reserve a unique code for this event; append digits on collision.
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = attempt === 0 ? base : `${base}${attempt + 1}`;
    const ref = db.collection(COLL).doc(`${input.eventId}:${code}`);
    const data = {
      event_id: input.eventId,
      organizer_id: input.organizerId,
      code,
      name: input.name,
      commission_cents: input.commissionCents,
      orders_count: 0,
      tickets_count: 0,
      gross_cents: 0,
      created_at: FieldValue.serverTimestamp(),
    };
    try {
      await ref.create(data);
      return toLink(ref.id, data);
    } catch (err) {
      if ((err as { code?: number }).code === ALREADY_EXISTS) continue;
      throw err;
    }
  }
  throw new Error("CODE_EXHAUSTED");
}

export async function listPromoterLinks(eventId: string): Promise<PromoterLink[]> {
  const snap = await getDb().collection(COLL).where("event_id", "==", eventId).get();
  return snap.docs.map((d) => toLink(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a ?p=code to its link id for an event (attribution at checkout). */
export async function resolvePromoterCode(eventId: string, code: string): Promise<PromoterLink | null> {
  const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  const snap = await getDb().collection(COLL).doc(`${eventId}:${clean}`).get();
  return snap.exists ? toLink(snap.id, snap.data()!) : null;
}

/** Adjust a promoter link's running totals (+ on sale, − on refund). */
export async function adjustPromoterStats(linkId: string, delta: { orders: number; tickets: number; gross: number }): Promise<void> {
  await getDb().collection(COLL).doc(linkId).update({
    orders_count: FieldValue.increment(delta.orders),
    tickets_count: FieldValue.increment(delta.tickets),
    gross_cents: FieldValue.increment(delta.gross),
  });
}
