import "server-only";
import { getDb } from "./firebase-admin";
import { listOrganizers } from "./organizers";

// Founder view: is the business moving? Computed straight from orders/events
// on each admin load — fine at this scale (capped at 5,000 orders); move to a
// rollup when it isn't.

export type FounderMetrics = {
  all: { gmv_cents: number; fees_cents: number; tickets: number; orders: number };
  last30: { gmv_cents: number; fees_cents: number; tickets: number; orders: number };
  refunds: { count: number; amount_cents: number };
  organizers: { total: number; onboarded: number };
  events: { total: number; on_sale: number; upcoming: number };
  buyers: number;
};

const D30 = 30 * 24 * 60 * 60 * 1000;

export async function getFounderMetrics(): Promise<FounderMetrics> {
  const db = getDb();
  const now = Date.now();
  const [orders, events, organizers, buyersCount] = await Promise.all([
    db.collection("orders").limit(5000).get(),
    db.collection("events").get(),
    listOrganizers(),
    db.collection("buyers").count().get(),
  ]);

  const all = { gmv_cents: 0, fees_cents: 0, tickets: 0, orders: 0 };
  const last30 = { gmv_cents: 0, fees_cents: 0, tickets: 0, orders: 0 };
  const refunds = { count: 0, amount_cents: 0 };
  for (const d of orders.docs) {
    const o = d.data();
    if (o.status === "refunded") {
      refunds.count++;
      refunds.amount_cents += o.total_cents ?? 0;
      continue;
    }
    if (o.status !== "paid" || o.channel === "comp" || o.channel === "transfer") continue;
    const created = (o.created_at as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const add = (b: typeof all) => {
      b.gmv_cents += o.subtotal_cents ?? 0;
      b.fees_cents += o.fee_cents ?? 0;
      b.tickets += o.quantity ?? 0;
      b.orders++;
    };
    add(all);
    if (now - created <= D30) add(last30);
  }

  let on_sale = 0;
  let upcoming = 0;
  for (const d of events.docs) {
    const e = d.data();
    if (e.status === "on_sale") on_sale++;
    const starts = (e.starts_at as { toMillis?: () => number })?.toMillis?.() ?? e.starts_at;
    if (typeof starts === "number" && starts > now && e.status === "on_sale") upcoming++;
  }

  return {
    all,
    last30,
    refunds,
    organizers: { total: organizers.length, onboarded: organizers.filter((o) => o.stripe_onboarded).length },
    events: { total: events.size, on_sale, upcoming },
    buyers: buyersCount.data().count,
  };
}
