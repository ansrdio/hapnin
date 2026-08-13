import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getOrderById, getTicketsByOrder } from "@/lib/orders";
import { getEventById } from "@/lib/events";
import { TransferForm } from "./TransferForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your tickets — Hapnin", robots: { index: false } };

function fmtDate(ms: number, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(new Date(ms));
}

export default async function TicketsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();
  const [event, allTickets] = await Promise.all([getEventById(order.event_id), getTicketsByOrder(orderId)]);
  if (!event) notFound();

  // Voided (refunded) tickets don't show a QR.
  const tickets = allTickets.filter((t) => !t.voided_at);
  const transferable = tickets.filter((t) => !t.checked_in_at).length;

  if (tickets.length === 0) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="font-display text-2xl font-bold text-cream">{event.title}</h1>
        <p className="mt-4 rounded-2xl border border-plum-hi bg-plum/40 p-5 text-mauve-dim">
          These tickets are no longer active — they were refunded or transferred.
        </p>
      </main>
    );
  }

  const qrs = await Promise.all(
    tickets.map((t) =>
      QRCode.toString(t.qr_token, {
        type: "svg",
        margin: 1,
        color: { dark: "#1B0A2A", light: "#ffffff" },
      })
    )
  );

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-gold">Your tickets</p>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-cream">{event.title}</h1>
      <p className="mt-2 text-mauve-dim">{fmtDate(event.starts_at, event.timezone)}</p>
      <p className="text-mauve-dim">{event.venue_name} · {event.venue_address}</p>

      <div className="mt-8 space-y-5">
        {tickets.map((t, i) => (
          <div key={t.id} className="rounded-2xl border border-plum-hi bg-plum/40 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display font-semibold text-cream">
                Ticket {i + 1} of {tickets.length}
              </span>
              {t.checked_in_at ? (
                <span className="rounded-full bg-emerald/15 px-3 py-1 text-xs text-emerald">Checked in</span>
              ) : (
                <span className="rounded-full bg-ink px-3 py-1 text-xs text-mauve-dim">Not scanned</span>
              )}
            </div>
            <div
              className="mx-auto w-full max-w-[240px] rounded-xl bg-white p-3"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: qrs[i] }}
            />
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-mauve-dim">
        Show this at the door. Screenshot it in case you lose signal.
      </p>

      <TransferForm orderId={orderId} transferable={transferable} />
    </main>
  );
}
