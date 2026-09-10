import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getOrderById, getTicketsByOrder, countReferrals } from "@/lib/orders";
import { CopyLink } from "@/app/components/CopyLink";
import { getEventById, getTier } from "@/lib/events";
import { isAppleWalletConfigured, isGoogleWalletConfigured } from "@/lib/wallet";
import { TransferForm } from "./TransferForm";
import { googleCalendarUrl, DEFAULT_DURATION_MS } from "@/lib/calendar";

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

  // After the night: invite a rating (one per ticket, first name only shown).
  const ended = event.starts_at + 6 * 60 * 60 * 1000 < Date.now();

  // Bring-a-friend: only when the organizer turned it on and this is an online order.
  const referral = event.referral_off_cents > 0 && order.ref_code ? { code: order.ref_code, count: await countReferrals(orderId) } : null;

  const appleWallet = isAppleWalletConfigured();
  const googleWallet = isGoogleWalletConfigured();

  // Add to calendar: .ics for Apple/Outlook, a prefilled link for Google.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const ticketUrl = `${site}/t/${orderId}`;
  const googleCal = googleCalendarUrl({
    uid: `${orderId}@hapnin.now`,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.starts_at + DEFAULT_DURATION_MS,
    location: [event.venue_name, event.venue_address, event.city, event.state].filter(Boolean).join(", "),
    description: `Your Hapnin ticket: ${ticketUrl}`,
    url: ticketUrl,
  });

  return (
    <main className="grain relative mx-auto max-w-md px-5 py-12">
      {event.flyer_url && (
        <div className="fixed inset-0 -z-10" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.flyer_url} alt="" className="h-full w-full scale-125 object-cover blur-3xl" />
          <div className="absolute inset-0 bg-ink/88" />
        </div>
      )}
      <p className="anim-rise text-xs font-semibold uppercase tracking-[0.24em] text-gold">Your tickets</p>
      <h1 className="anim-rise d-1 mt-2 font-display text-3xl font-bold leading-tight text-cream">
        {event.title}
      </h1>
      <p className="anim-rise d-1 mt-3 text-mauve-dim">{fmtDate(event.starts_at, event.timezone)}</p>
      <p className="anim-rise d-1 text-mauve-dim">{event.venue_name} · {event.venue_address}</p>
      {tier && tier.kind === "table" && (
        <p className="anim-rise d-1 mt-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3.5 py-1.5 text-sm text-gold">
          {tier.name} · admits up to {tier.seats} guests
        </p>
      )}

      <div className="anim-rise d-1 mt-5 flex flex-wrap gap-2">
        <a
          href={`/t/${orderId}/calendar.ics`}
          className="rounded-lg border border-plum-hi px-3.5 py-2 text-sm font-semibold text-cream hover:bg-plum"
        >
          Add to calendar
        </a>
        <a
          href={googleCal}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-plum-hi px-3.5 py-2 text-sm text-mauve-dim hover:text-cream"
        >
          Google Calendar
        </a>
      </div>

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

      {ended && (
        <div className="anim-rise d-2 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/5 px-5 py-4">
          <div>
            <p className="font-display font-semibold text-cream">How was the night?</p>
            <p className="text-sm text-mauve-dim">Your rating helps the next person decide.</p>
          </div>
          <a href={`/r/${orderId}`} className="rounded-xl bg-gold px-4 py-2.5 font-display text-sm font-semibold text-ink hover:bg-gold-hi">
            Rate it
          </a>
        </div>
      )}

      <TransferForm orderId={orderId} transferable={transferable} />

      {referral && (
        <div className="anim-rise d-3 mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <p className="font-display font-semibold text-cream">
            Bring friends — they get ${(event.referral_off_cents / 100).toFixed(0)} off.
          </p>
          <p className="mt-0.5 text-sm text-mauve-dim">
            Share your link; the discount applies at their checkout.
            {referral.count > 0 && ` ${referral.count} friend${referral.count === 1 ? "" : "s"} joined so far.`}
          </p>
          <div className="mt-3">
            <CopyLink value={`${site}/e/${event.slug}?friend=${referral.code}`} />
          </div>
        </div>
      )}
    </main>
  );
}
