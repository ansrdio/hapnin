import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolvePromoterCode } from "@/lib/promoters";
import { getEventById } from "@/lib/events";
import { money } from "@/app/components/ui";
import { CopyField } from "./CopyField";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your promoter link — Hapnin", robots: { index: false } };

function fmtDate(ms: number, tz: string): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function PromoterPage({ params }: { params: Promise<{ eventId: string; code: string }> }) {
  const { eventId, code } = await params;
  const [link, event] = await Promise.all([resolvePromoterCode(eventId, code), getEventById(eventId)]);
  if (!link || !event) notFound();

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const url = `${site}/e/${event.slug}?p=${link.code}`;
  const owed = link.commission_cents * link.orders_count;

  return (
    <main className="grain relative mx-auto max-w-lg px-5 py-12">
      {event.flyer_url && (
        <div className="fixed inset-0 -z-10" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.flyer_url} alt="" className="h-full w-full scale-125 object-cover blur-3xl" />
          <div className="absolute inset-0 bg-ink/88" />
        </div>
      )}

      <p className="anim-rise text-xs font-semibold uppercase tracking-[0.24em] text-gold">Promoter · {link.name}</p>
      <h1 className="anim-rise d-1 mt-2 font-display text-3xl font-bold leading-tight text-cream">{event.title}</h1>
      <p className="anim-rise d-1 mt-2 text-mauve-dim">
        {fmtDate(event.starts_at, event.timezone)} · {event.venue_name}
      </p>

      {/* Your numbers */}
      <div className="anim-rise d-2 mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Sold through you</div>
          <div className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-cream">{link.tickets_count}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Sales</div>
          <div className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-cream">{money(link.gross_cents)}</div>
        </div>
      </div>

      {link.commission_cents > 0 && (
        <div className="anim-rise d-2 mt-4 flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">You’ve earned</div>
            <div className="mt-1 text-sm text-mauve-dim">{money(link.commission_cents)} per order · {link.orders_count} orders</div>
          </div>
          <div className="font-display text-3xl font-semibold tabular-nums text-cream">{money(owed)}</div>
        </div>
      )}

      {/* Share */}
      <div className="anim-rise d-3 mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Your link</h2>
        <CopyField url={url} />
        <p className="mt-2 text-sm text-mauve-dim">
          Share this everywhere. Every ticket bought through it counts toward your total.
        </p>
      </div>
    </main>
  );
}
