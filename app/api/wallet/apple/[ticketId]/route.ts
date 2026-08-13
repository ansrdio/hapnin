import { NextResponse } from "next/server";
import { getTicketById } from "@/lib/orders";
import { getEventById } from "@/lib/events";
import { applePkpass, isAppleWalletConfigured } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!isAppleWalletConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const { ticketId } = await params;
  const ticket = await getTicketById(ticketId);
  if (!ticket || ticket.voided_at) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const event = await getEventById(ticket.event_id);
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const pkpass = await applePkpass(ticket, event);
    return new NextResponse(new Uint8Array(pkpass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="ticket-${ticket.id}.pkpass"`,
      },
    });
  } catch (err) {
    console.error("apple pkpass error", err);
    return NextResponse.json({ error: "pass_failed" }, { status: 500 });
  }
}
