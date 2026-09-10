import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { getEventById } from "@/lib/events";
import { buildIcs, DEFAULT_DURATION_MS } from "@/lib/calendar";

export const runtime = "nodejs";

// .ics for a ticket holder's event (Apple Calendar, Outlook). The order id is
// unguessable, same as the ticket page itself; the file carries the ticket link.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) return new NextResponse("Not found", { status: 404 });
  const event = await getEventById(order.event_id);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const url = `${site}/t/${orderId}`;
  const ics = buildIcs({
    uid: `${orderId}@hapnin.now`,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.starts_at + DEFAULT_DURATION_MS,
    location: [event.venue_name, event.venue_address, event.city, event.state].filter(Boolean).join(", "),
    description: `Your Hapnin ticket: ${url}`,
    url,
  });

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
