import "server-only";
import { getDb } from "./firebase-admin";
import { getTiers } from "./events";

// Read model for an event's guest list — one row per order, joined to buyer name,
// tier, and live check-in count. Three bulk reads (orders, tickets, buyers), no
// per-row N+1, all keyed on the single-field-indexed event_id.

export type GuestRow = {
  orderId: string;
  name: string;
  phone: string;
  tierName: string;
  quantity: number;
  channel: string; // "online" | "comp"
  status: string; // "paid" | "refunded"
  totalCents: number;
  checkedIn: number;
  createdAt: number | null;
  refundable: boolean;
};

function ms(v: unknown): number | null {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : null;
}

export async function getEventGuests(eventId: string): Promise<GuestRow[]> {
  const db = getDb();
  const [ordersSnap, ticketsSnap, tiers] = await Promise.all([
    db.collection("orders").where("event_id", "==", eventId).get(),
    db.collection("tickets").where("event_id", "==", eventId).get(),
    getTiers(eventId),
  ]);

  // Check-ins per order.
  const checkedByOrder = new Map<string, number>();
  for (const t of ticketsSnap.docs) {
    const d = t.data();
    if (d.checked_in_at) checkedByOrder.set(d.order_id, (checkedByOrder.get(d.order_id) ?? 0) + 1);
  }

  // Buyer names in one bulk read.
  const phones = [...new Set(ordersSnap.docs.map((d) => d.data().buyer_id as string).filter(Boolean))];
  const names = new Map<string, string>();
  if (phones.length) {
    const buyerSnaps = await db.getAll(...phones.map((p) => db.collection("buyers").doc(p)));
    for (const b of buyerSnaps) {
      if (b.exists) {
        const d = b.data()!;
        names.set(b.id, [d.first_name, d.last_name].filter(Boolean).join(" ") || b.id);
      }
    }
  }

  const tierName = new Map(tiers.map((t) => [t.id, t.name]));

  const rows: GuestRow[] = ordersSnap.docs.map((doc) => {
    const d = doc.data();
    const channel = d.channel ?? "online";
    const status = d.status ?? "paid";
    return {
      orderId: doc.id,
      name: names.get(d.buyer_id) ?? d.buyer_id,
      phone: d.buyer_id,
      tierName: tierName.get(d.tier_id) ?? "—",
      quantity: d.quantity ?? 0,
      channel,
      status,
      totalCents: d.total_cents ?? 0,
      checkedIn: checkedByOrder.get(doc.id) ?? 0,
      createdAt: ms(d.created_at),
      refundable: status === "paid" && channel === "online" && !!d.stripe_payment_intent_id,
    };
  });

  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return rows;
}
