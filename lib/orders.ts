import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";

export type OrderRecord = {
  id: string;
  event_id: string;
  buyer_id: string;
  tier_id: string;
  quantity: number;
  subtotal_cents: number;
  total_cents: number;
  status: string;
  created_at: number | null;
};

export type TicketRecord = {
  id: string;
  order_id: string;
  event_id: string;
  buyer_id: string;
  qr_token: string;
  is_comp: boolean;
  checked_in_at: number | null;
};

function ms(v: unknown): number | null {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : null;
}

function toOrder(id: string, d: FirebaseFirestore.DocumentData): OrderRecord {
  return {
    id,
    event_id: d.event_id,
    buyer_id: d.buyer_id,
    tier_id: d.tier_id,
    quantity: d.quantity,
    subtotal_cents: d.subtotal_cents,
    total_cents: d.total_cents,
    status: d.status,
    created_at: ms(d.created_at),
  };
}

function toTicket(id: string, d: FirebaseFirestore.DocumentData): TicketRecord {
  return {
    id,
    order_id: d.order_id,
    event_id: d.event_id,
    buyer_id: d.buyer_id,
    qr_token: d.qr_token,
    is_comp: !!d.is_comp,
    checked_in_at: ms(d.checked_in_at),
  };
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  const snap = await getDb().collection("orders").doc(id).get();
  return snap.exists ? toOrder(snap.id, snap.data()!) : null;
}

export async function getOrderByPaymentIntent(pi: string): Promise<OrderRecord | null> {
  const snap = await getDb().collection("orders").where("stripe_payment_intent_id", "==", pi).limit(1).get();
  return snap.empty ? null : toOrder(snap.docs[0].id, snap.docs[0].data());
}

export async function getTicketsByOrder(orderId: string): Promise<TicketRecord[]> {
  const snap = await getDb().collection("tickets").where("order_id", "==", orderId).get();
  return snap.docs.map((d) => toTicket(d.id, d.data()));
}

export async function getTicketById(id: string): Promise<TicketRecord | null> {
  const snap = await getDb().collection("tickets").doc(id).get();
  return snap.exists ? toTicket(snap.id, snap.data()!) : null;
}

/**
 * Manually check in every not-yet-scanned, non-voided ticket of an order (door
 * fallback when a QR won't scan / a party arrives together). Returns how many
 * were newly checked in and bumps the event's counter to match.
 */
export async function checkInOrder(eventId: string, orderId: string, byId: string): Promise<number> {
  const db = getDb();
  const snap = await db.collection("tickets").where("order_id", "==", orderId).get();
  const batch = db.batch();
  let count = 0;
  for (const t of snap.docs) {
    const d = t.data();
    if (d.checked_in_at || d.voided_at) continue;
    batch.update(t.ref, { checked_in_at: FieldValue.serverTimestamp(), checked_in_by: byId });
    count++;
  }
  if (count > 0) {
    batch.update(db.collection("events").doc(eventId), { checked_in: FieldValue.increment(count) });
    await batch.commit();
  }
  return count;
}
