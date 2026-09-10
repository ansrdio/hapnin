import "server-only";
import { getDb } from "./firebase-admin";
import { getTiers } from "./events";

// Door-night numbers and buyer-consented social proof.

export type DoorStats = {
  sold: number; // live (non-voided) tickets
  checkedIn: number;
  byTier: { name: string; sold: number; checkedIn: number }[];
  recent: { name: string; at: number }[]; // last check-ins, newest first
};

/** Live stats for the door board: totals, per tier, and the latest check-ins. */
export async function getDoorStats(eventId: string): Promise<DoorStats> {
  const db = getDb();
  const [tickets, orders, tiers] = await Promise.all([
    db.collection("tickets").where("event_id", "==", eventId).get(),
    db.collection("orders").where("event_id", "==", eventId).get(),
    getTiers(eventId),
  ]);
  const tierOfOrder = new Map(orders.docs.map((o) => [o.id, o.data().tier_id as string]));
  const counts = new Map<string, { sold: number; checkedIn: number }>();
  let sold = 0;
  let checkedIn = 0;
  const recentRaw: { phone: string; at: number }[] = [];

  for (const t of tickets.docs) {
    const d = t.data();
    if (d.voided_at) continue;
    sold++;
    const tierId = tierOfOrder.get(d.order_id) ?? "?";
    const c = counts.get(tierId) ?? { sold: 0, checkedIn: 0 };
    c.sold++;
    if (d.checked_in_at) {
      checkedIn++;
      c.checkedIn++;
      const at = (d.checked_in_at as { toMillis?: () => number })?.toMillis?.() ?? 0;
      recentRaw.push({ phone: d.buyer_id, at });
    }
    counts.set(tierId, c);
  }

  recentRaw.sort((a, b) => b.at - a.at);
  const top = recentRaw.slice(0, 10);
  const names = new Map<string, string>();
  const phones = [...new Set(top.map((r) => r.phone).filter(Boolean))];
  if (phones.length) {
    const snaps = await db.getAll(...phones.map((p) => db.collection("buyers").doc(p)));
    snaps.forEach((s) => {
      if (s.exists) names.set(s.id, (s.data()!.first_name as string) || "Guest");
    });
  }

  return {
    sold,
    checkedIn,
    byTier: tiers.map((t) => ({ name: t.name, sold: counts.get(t.id)?.sold ?? 0, checkedIn: counts.get(t.id)?.checkedIn ?? 0 })),
    recent: top.map((r) => ({ name: names.get(r.phone) ?? "Guest", at: r.at })),
  };
}

/**
 * First names for "Ada, Chidi and 41 others going" — only from paid buyers who
 * left "show my first name" on at checkout. Comps never appear (no consent).
 */
export async function getGoingNames(eventId: string, max = 2): Promise<string[]> {
  const db = getDb();
  const orders = await db.collection("orders").where("event_id", "==", eventId).get();
  const phones = [
    ...new Set(
      orders.docs
        .filter((o) => o.data().status === "paid" && o.data().channel !== "comp")
        .map((o) => o.data().buyer_id as string)
        .filter(Boolean)
    ),
  ].slice(0, 50);
  if (phones.length === 0) return [];
  const snaps = await db.getAll(...phones.map((p) => db.collection("buyers").doc(p)));
  const names: string[] = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const b = s.data()!;
    if (b.show_name === false || !b.first_name) continue;
    names.push(String(b.first_name).trim());
    if (names.length >= max) break;
  }
  return names;
}
