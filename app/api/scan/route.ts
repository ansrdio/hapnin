import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireScanAccess } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { getEventById } from "@/lib/events";
import { verifyQrToken } from "@/lib/qr";

export const runtime = "nodejs";

// Validate + check in a scanned ticket. Organizer-authed, and the event must
// belong to them. First-check-in-wins is enforced in a Firestore transaction, so
// two door phones scanning the same ticket can't both admit.
export async function POST(req: Request) {
  const { organizer } = await requireScanAccess();
  const { eventId, token } = (await req.json().catch(() => ({}))) as { eventId?: string; token?: string };
  if (!eventId || !token) return NextResponse.json({ result: "invalid" });

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) {
    return NextResponse.json({ result: "invalid" }, { status: 403 });
  }

  const ticketId = verifyQrToken(token);
  if (!ticketId) return NextResponse.json({ result: "invalid" });

  const db = getDb();
  const ref = db.collection("tickets").doc(ticketId);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { result: "invalid" as const };
    const d = snap.data()!;
    if (d.event_id !== eventId) return { result: "wrong_event" as const };
    if (d.checked_in_at) {
      const at = (d.checked_in_at as { toMillis?: () => number }).toMillis?.() ?? null;
      return { result: "used" as const, buyer: d.buyer_id as string, at };
    }
    tx.update(ref, { checked_in_at: FieldValue.serverTimestamp(), checked_in_by: organizer.id });
    return { result: "valid" as const, buyer: d.buyer_id as string };
  });

  // Name for the door, and the running counter.
  let name: string | null = null;
  if ("buyer" in outcome && outcome.buyer) {
    const b = await db.collection("buyers").doc(outcome.buyer).get();
    if (b.exists) name = [b.data()!.first_name, b.data()!.last_name].filter(Boolean).join(" ") || null;
  }
  if (outcome.result === "valid") {
    await db.collection("events").doc(eventId).update({ checked_in: FieldValue.increment(1) });
  }
  const evSnap = await db.collection("events").doc(eventId).get();
  const count = evSnap.data()?.checked_in ?? 0;

  return NextResponse.json({
    result: outcome.result,
    name,
    at: "at" in outcome ? outcome.at : null,
    count,
  });
}
