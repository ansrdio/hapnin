import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { getEventById } from "@/lib/events";

export const runtime = "nodejs";

// Offline scanning, part 1: everything the door needs to decide a scan
// without the network — every live ticket id for this event, the guest's first
// name, and whether it's already been used. The scanner refreshes this while
// it has signal and falls back to it when it doesn't. Ticket ids are
// unguessable (they're the secret half of the QR), so membership is the check.
export async function GET(req: Request) {
  const { organizer } = await requireScanAccess();
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = getDb();
  const tickets = await db.collection("tickets").where("event_id", "==", eventId).limit(5000).get();
  const phones = [...new Set(tickets.docs.map((t) => t.data().buyer_id as string).filter(Boolean))];
  const names = new Map<string, string>();
  for (let i = 0; i < phones.length; i += 500) {
    const snaps = await db.getAll(...phones.slice(i, i + 500).map((p) => db.collection("buyers").doc(p)));
    snaps.forEach((s) => {
      if (s.exists) names.set(s.id, [s.data()!.first_name, s.data()!.last_name].filter(Boolean).join(" ") || "Guest");
    });
  }

  const list = tickets.docs
    .filter((t) => !t.data().voided_at)
    .map((t) => {
      const d = t.data();
      const at = (d.checked_in_at as { toMillis?: () => number } | null)?.toMillis?.() ?? null;
      return { id: t.id, name: names.get(d.buyer_id) ?? "Guest", used_at: at };
    });

  return NextResponse.json(
    { eventId, title: event.title, tickets: list, fetched_at: Date.now() },
    { headers: { "cache-control": "private, no-store" } }
  );
}
