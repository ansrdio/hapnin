import "server-only";
import { getDb } from "./firebase-admin";
import { getTiers } from "./events";

// Event analytics computed from orders + tickets. "Sales" = paid orders that
// aren't transfers (transfers move existing tickets at $0 and would double-count).
// Comps count as tickets at $0 gross. Refunds are excluded and counted separately.

export type Bar = { label: string; tickets: number; gross_cents: number };

export type EventAnalytics = {
  gross_cents: number;
  tickets: number;
  orders: number;
  refunds: number;
  checkedIn: number;
  totalTickets: number;
  byDay: Bar[];
  byTier: Bar[];
  byChannel: Bar[];
  bySource: Bar[];
};

function ms(v: unknown): number | null {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : null;
}

function dayKey(msVal: number | null): string {
  if (!msVal) return "—";
  return new Date(msVal).toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
  });
}

function bucket(map: Map<string, Bar>, label: string, qty: number, gross: number) {
  const b = map.get(label) ?? { label, tickets: 0, gross_cents: 0 };
  b.tickets += qty;
  b.gross_cents += gross;
  map.set(label, b);
}

export async function getEventAnalytics(eventId: string): Promise<EventAnalytics> {
  const db = getDb();
  const [ordersSnap, ticketsSnap, tiers] = await Promise.all([
    db.collection("orders").where("event_id", "==", eventId).get(),
    db.collection("tickets").where("event_id", "==", eventId).get(),
    getTiers(eventId),
  ]);

  const tierName = new Map(tiers.map((t) => [t.id, t.name]));
  const byDay = new Map<string, Bar>();
  const dayOrder = new Map<string, number>(); // label → earliest ms, for sorting
  const byTier = new Map<string, Bar>();
  const byChannel = new Map<string, Bar>();
  const bySource = new Map<string, Bar>();

  let gross = 0;
  let tickets = 0;
  let orders = 0;
  let refunds = 0;

  for (const doc of ordersSnap.docs) {
    const d = doc.data();
    if (d.status === "refunded") { refunds++; continue; }
    if (d.status !== "paid") continue;
    if (d.channel === "transfer") continue; // moves existing tickets, not a sale

    const qty = d.quantity ?? 0;
    const sub = d.subtotal_cents ?? 0;
    gross += sub;
    tickets += qty;
    orders++;

    const dk = dayKey(ms(d.created_at));
    bucket(byDay, dk, qty, sub);
    const cm = ms(d.created_at) ?? 0;
    if (!dayOrder.has(dk) || cm < dayOrder.get(dk)!) dayOrder.set(dk, cm);
    bucket(byTier, tierName.get(d.tier_id) ?? "—", qty, sub);
    bucket(byChannel, d.channel ?? "online", qty, sub);
    bucket(bySource, d.referral_source || (d.channel === "online" ? "direct" : d.channel || "—"), qty, sub);
  }

  let checkedIn = 0;
  let totalTickets = 0;
  for (const t of ticketsSnap.docs) {
    const d = t.data();
    if (d.voided_at) continue;
    totalTickets++;
    if (d.checked_in_at) checkedIn++;
  }

  const sortDesc = (a: Bar, b: Bar) => b.tickets - a.tickets;
  return {
    gross_cents: gross,
    tickets,
    orders,
    refunds,
    checkedIn,
    totalTickets,
    byDay: [...byDay.values()].sort((a, b) => (dayOrder.get(a.label) ?? 0) - (dayOrder.get(b.label) ?? 0)),
    byTier: [...byTier.values()].sort(sortDesc),
    byChannel: [...byChannel.values()].sort(sortDesc),
    bySource: [...bySource.values()].sort(sortDesc),
  };
}
