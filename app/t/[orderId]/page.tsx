import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getOrderById, getTicketsByOrder } from "@/lib/orders";
import { getEventById, getTier } from "@/lib/events";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet";
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
  const [event, allTickets, tier] = await Promise.all([
    getEventById(order.event_id),
    getTicketsByOrder(orderId),
    getTier(order.event_id, order.tier_id),
  ]);
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

  const appleWallet = isAppleWalletConfigured();
  const googleWallet = isGoogleWalletConfigured();

  return (
    <main className="grain mx-auto max-w-md px-5 py-12">
      <p className="anim-rise text-xs font-semibold uppercase tracking-[0.24em] text-gold">Your tickets</p>
      <h1 className="anim-rise d-1 masthead-shadow mt-2 font-display text-3xl font-bold leading-tight text-cream">
        {event.title}
      </h1>
      <p className="anim-rise d-1 mt-3 text-mauve-dim">{fmtDate(event.starts_at, event.timezone)}</p>
      <p className="anim-rise d-1 text-mauve-dim">{event.venue_name} · {event.venue_address}</p>
      {tier && tier.kind === "table" && (
        <p className="anim-rise d-1 mt-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3.5 py-1.5 text-sm text-gold">
          {tier.name} · admits up to {tier.seats} guests
        </p>
      )}

      <div className="mt-8 space-y-5">
        {tickets.map((t, i) => (
          <div key={t.id} className="anim-rise d-2 overflow-hidden rounded-3xl border border-plum-hi bg-plum/40">
            <div className="flex items-center justify-between px-5 pt-5">
              <span className="font-display font-semibold text-cream">
                Ticket {i + 1} of {tickets.length}
              </span>
              {t.checked_in_at ? (
                <span className="rounded-full bg-emerald/15 px-3 py-1 text-xs font-medium text-emerald">Checked in</span>
              ) : (
                <span className="rounded-full border border-plum-hi px-3 py-1 text-xs text-mauve-dim">Not scanned</span>
              )}
            </div>
            <div className="p-5">
              <div
                className={`mx-auto w-full max-w-[240px] rounded-2xl bg-white p-3 ${t.checked_in_at ? "opacity-40" : ""}`}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: qrs[i] }}
              />
            </div>
            {(appleWallet || googleWallet) && !t.checked_in_at && (
              <div className="flex flex-wrap justify-center gap-2 border-t border-plum-hi/70 px-5 py-4">
                {appleWallet && (
                  <a href={`/api/wallet/apple/${t.id}`} className="rounded-lg border border-plum-hi px-4 py-2 text-sm font-semibold text-cream hover:bg-plum">
                     Apple Wallet
                  </a>
                )}
                {googleWallet && (
                  <a href={`/api/wallet/google/${t.id}`} className="rounded-lg border border-plum-hi px-4 py-2 text-sm font-semibold text-cream hover:bg-plum">
                    Google Wallet
                  </a>
                )}
              </div>
            )}
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
