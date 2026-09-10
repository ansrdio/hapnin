import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireScanAccess } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { getEventById } from "@/lib/events";

export const runtime = "nodejs";

// Offline scanning, part 2: check-ins the door decided while offline, replayed
// when signal returns. First scan wins — if another phone admitted the same
// ticket first, this one is reported as a conflict so the door can follow up.
export async function POST(req: Request) {
  const { organizer } = await requireScanAccess();
  const body = (await req.json().catch(() => ({}))) as { eventId?: string; items?: { id: string; at: number }[] };
  const eventId = body.eventId ?? "";
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = getDb();
  const results: { id: string; result: "applied" | "already_used" | "invalid" }[] = [];
  let applied = 0;

  for (const item of items) {
    if (!item?.id || typeof item.id !== "string") continue;
    const ref = db.collection("tickets").doc(item.id);
    const at = typeof item.at === "number" && item.at > 0 ? Timestamp.fromMillis(item.at) : FieldValue.serverTimestamp();
    const r = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "invalid" as const;
      const d = snap.data()!;
      if (d.voided_at || d.event_id !== eventId) return "invalid" as const;
      if (d.checked_in_at) return "already_used" as const;
      tx.update(ref, { checked_in_at: at, checked_in_by: organizer.id, checked_in_offline: true });
      return "applied" as const;
    });
    if (r === "applied") applied++;
    results.push({ id: item.id, result: r });
  }
  if (applied > 0) await db.collection("events").doc(eventId).update({ checked_in: FieldValue.increment(applied) });

  const evSnap = await db.collection("events").doc(eventId).get();
  return NextResponse.json({ applied, results, count: evSnap.data()?.checked_in ?? 0 });
}
