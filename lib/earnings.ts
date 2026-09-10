import "server-only";
import { getDb } from "./firebase-admin";
import { getTiers } from "./events";

// "What do I actually get?" — per-event money, from the source of truth
// (orders), split the way an organizer thinks about it.
//
// Online (Stripe) orders: buyers pay face value + card processing; Stripe pays
// the organizer's connected account; Hapnin's application fee comes out of the
// organizer's side. So: net = face value − Hapnin fee. Card processing is shown
// for transparency but is neither the organizer's income nor their cost.
//
// Door (box office) orders: cash / external card the organizer already holds;
// no Hapnin fee today, so net = face value.

export type EarningsLine = {
  tickets: number;
  face_cents: number; // after discounts
  discount_cents: number;
  card_fee_cents: number; // buyer-paid, online only
  hapnin_fee_cents: number;
  net_cents: number;
};

export type TierEarnings = { tierId: string; name: string; tickets: number; face_cents: number };

export type EventEarnings = {
  online: EarningsLine;
  door: EarningsLine;
  comps: number;
  refunded: { orders: number; amount_cents: number };
  tiers: TierEarnings[];
  total_net_cents: number;
};

const zero = (): EarningsLine => ({ tickets: 0, face_cents: 0, discount_cents: 0, card_fee_cents: 0, hapnin_fee_cents: 0, net_cents: 0 });

export async function getEventEarnings(eventId: string): Promise<EventEarnings> {
  const db = getDb();
  const [orders, tiers] = await Promise.all([
    db.collection("orders").where("event_id", "==", eventId).get(),
    getTiers(eventId),
  ]);

  const online = zero();
  const door = zero();
  let comps = 0;
  const refunded = { orders: 0, amount_cents: 0 };
  const byTier: Record<string, { tickets: number; face_cents: number }> = {};

  for (const d of orders.docs) {
    const o = d.data();
    const qty = o.quantity ?? 0;
    if (o.status === "refunded") {
      refunded.orders++;
      refunded.amount_cents += o.total_cents ?? 0;
      continue;
    }
    if (o.status !== "paid") continue; // refunding / anything transient
    if (o.channel === "comp") {
      comps += qty;
      continue;
    }
    const line = o.channel === "door" ? door : online;
    const sub = o.subtotal_cents ?? 0;
    const tot = o.total_cents ?? sub;
    const fee = o.fee_cents ?? 0;
    line.tickets += qty;
    line.face_cents += sub;
    line.discount_cents += o.discount_cents ?? 0;
    line.card_fee_cents += Math.max(0, tot - sub);
    line.hapnin_fee_cents += fee;
    line.net_cents += sub - fee;
    const t = (byTier[o.tier_id] ??= { tickets: 0, face_cents: 0 });
    t.tickets += qty;
    t.face_cents += sub;
  }

  return {
    online,
    door,
    comps,
    refunded,
    tiers: tiers.map((t) => ({
      tierId: t.id,
      name: t.name,
      tickets: byTier[t.id]?.tickets ?? 0,
      face_cents: byTier[t.id]?.face_cents ?? 0,
    })),
    total_net_cents: online.net_cents + door.net_cents,
  };
}
