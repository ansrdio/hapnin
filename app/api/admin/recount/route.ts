import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Admin-only counter repair. Recomputes an event's live counters from the
// source of truth and reports the drift; writes ONLY with &apply=1.
//
//   tier.quantity_sold = paid orders for the tier (every channel: online, comp,
//                        box office — they all reserve inventory) + live holds
//                        (pending orders still reserved / being fulfilled)
//   event.tickets_sold = paid orders, every channel
//   event.gross_cents  = paid orders' subtotal, comps excluded (REPORTED only —
//                        money numbers are never rewritten automatically)
//
// Exists because counters are incremented/decremented by many code paths and a
// past race double-released a hold. Remove before launch, or keep admin-only.
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const apply = url.searchParams.get("apply") === "1";
  if (!eventId) return NextResponse.json({ error: "pass ?eventId=..." }, { status: 400 });

  const db = getDb();
  const eventRef = db.collection("events").doc(eventId);
  const [eventSnap, tiers, orders, pendings] = await Promise.all([
    eventRef.get(),
    eventRef.collection("tiers").get(),
    db.collection("orders").where("event_id", "==", eventId).get(),
    db.collection("pending_orders").where("event_id", "==", eventId).get(),
  ]);
  if (!eventSnap.exists) return NextResponse.json({ error: "event not found" }, { status: 404 });

  const paidByTier: Record<string, number> = {};
  let paidTotal = 0;
  let gross = 0;
  for (const d of orders.docs) {
    const o = d.data();
    if (o.status !== "paid") continue; // refunded / refunding don't hold a seat
    const q = o.quantity ?? 0;
    paidByTier[o.tier_id] = (paidByTier[o.tier_id] ?? 0) + q;
    paidTotal += q;
    if (o.channel !== "comp") gross += o.subtotal_cents ?? 0;
  }
  const holdsByTier: Record<string, number> = {};
  for (const d of pendings.docs) {
    const p = d.data();
    if (p.status !== "reserved" && p.status !== "fulfilling") continue;
    holdsByTier[p.tier_id] = (holdsByTier[p.tier_id] ?? 0) + (p.quantity ?? 0);
  }

  const tierReport = tiers.docs.map((t) => {
    const d = t.data();
    const current = d.quantity_sold ?? 0;
    const paid = paidByTier[t.id] ?? 0;
    const holds = holdsByTier[t.id] ?? 0;
    const expected = paid + holds;
    return { tierId: t.id, name: d.name, current, expected, paid, holds, drift: current - expected };
  });
  const ev = eventSnap.data()!;
  const eventReport = {
    tickets_sold: { current: ev.tickets_sold ?? 0, expected: paidTotal, drift: (ev.tickets_sold ?? 0) - paidTotal },
    gross_cents: { current: ev.gross_cents ?? 0, expected: gross, drift: (ev.gross_cents ?? 0) - gross, note: "reported only, never auto-written" },
  };

  let applied: string[] = [];
  if (apply) {
    const batch = db.batch();
    for (const t of tierReport) {
      if (t.drift === 0) continue;
      batch.update(eventRef.collection("tiers").doc(t.tierId), { quantity_sold: t.expected });
      applied.push(`tier ${t.name}: ${t.current} → ${t.expected}`);
    }
    if (eventReport.tickets_sold.drift !== 0) {
      batch.update(eventRef, { tickets_sold: paidTotal });
      applied.push(`event.tickets_sold: ${eventReport.tickets_sold.current} → ${paidTotal}`);
    }
    if (applied.length) await batch.commit();
    else applied = ["nothing to fix — counters already match"];
  }

  return NextResponse.json({
    eventId,
    title: ev.title,
    tiers: tierReport,
    event: eventReport,
    applied: apply ? applied : undefined,
    hint: apply ? undefined : "dry run — add &apply=1 to write the expected values",
  });
}
