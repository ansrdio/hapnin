import { NextResponse } from "next/server";
import { getTicketById } from "@/lib/orders";
import { getEventById } from "@/lib/events";
import { googleSaveUrl, isGoogleWalletConfigured } from "@/lib/wallet";

export const runtime = "nodejs";

// The ticket link is the bearer credential, so ticketId alone authorizes the pass.
export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!isGoogleWalletConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const { ticketId } = await params;
  const ticket = await getTicketById(ticketId);
  if (!ticket || ticket.voided_at) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const event = await getEventById(ticket.event_id);
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.redirect(googleSaveUrl(ticket, event));
}
