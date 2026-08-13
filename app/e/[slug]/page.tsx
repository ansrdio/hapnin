import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug, getTiers, type Tier } from "@/lib/events";
import { getOrganizerById } from "@/lib/organizers";
import { resolvePromoterCode } from "@/lib/promoters";
import { WaitlistForm } from "./WaitlistForm";
import { ShareButton } from "./ShareButton";

export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function fmtDate(ms: number, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(new Date(ms));
}

function tierStatus(t: Tier): { available: boolean; label: string | null } {
  const now = Date.now();
  if (!t.is_active) return { available: false, label: "Unavailable" };
  if (t.sales_start_at && now < t.sales_start_at) return { available: false, label: "Not yet on sale" };
  if (t.sales_end_at && now > t.sales_end_at) return { available: false, label: "Sales closed" };
  if (t.quantity_sold >= t.quantity_total) return { available: false, label: "Sold out" };
  return { available: true, label: null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found — Hapnin" };
  return {
    title: `${event.title} — Hapnin`,
    description: `${event.venue_name}, ${event.city}. Tickets on Hapnin.`,
    openGraph: event.flyer_url
      ? { title: event.title, images: [{ url: event.flyer_url }] }
      : { title: event.title },
  };
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-gold" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-gold" aria-hidden="true">
      <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-gold" aria-label="Verified organizer">
      <path
        d="M12 2l2.2 1.6 2.7-.2 1 2.5 2.3 1.5-.7 2.6.7 2.6-2.3 1.5-1 2.5-2.7-.2L12 22l-2.2-1.6-2.7.2-1-2.5-2.3-1.5.7-2.6L3.8 11l2.3-1.5 1-2.5 2.7.2L12 2z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M8.5 12l2.2 2.2 4.3-4.4" stroke="#1B0A2A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const { p } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [tiers, organizer] = await Promise.all([getTiers(event.id), getOrganizerById(event.organizer_id)]);
  const gaTiers = tiers.filter((t) => t.kind !== "table");
  const tableTiers = tiers.filter((t) => t.kind === "table");
  const onSale = event.status === "on_sale";
  const allSoldOut = tiers.length > 0 && tiers.every((t) => !tierStatus(t).available);

  const priceable = tiers.filter((t) => tierStatus(t).available);
  const minPrice = (priceable.length ? priceable : tiers).reduce((m, t) => Math.min(m, t.price_cents), Infinity);
  const fromPrice = Number.isFinite(minPrice) ? minPrice : 0;

  // Promoter attribution — validate the code so we only forward/celebrate real ones.
  const promoter = p ? await resolvePromoterCode(event.id, p) : null;
  const checkoutHref = promoter ? `/e/${event.slug}/checkout?p=${promoter.code}` : `/e/${event.slug}/checkout`;
  const tableHref = (id: string) => `${checkoutHref}${checkoutHref.includes("?") ? "&" : "?"}tier=${id}`;

  const Flyer = event.flyer_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.flyer_url}
      alt=""
      className="anim-bloom w-full rounded-3xl border border-white/10 object-cover shadow-2xl shadow-black/50"
    />
  ) : (
    <div
      className="anim-bloom aspect-square w-full rounded-3xl border border-white/10"
      style={{
        backgroundImage:
          "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.35), rgba(242,89,63,0.18) 55%, rgba(27,10,42,0.6) 85%)",
      }}
      aria-hidden="true"
    />
  );

  return (
    <main className="grain relative min-h-[100svh] pb-28">
      {/* Blurred flyer tints the whole page to the event */}
      {event.flyer_url && (
        <div className="fixed inset-0 -z-10" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.flyer_url} alt="" className="h-full w-full scale-125 object-cover blur-3xl" />
          <div className="absolute inset-0 bg-ink/85" />
        </div>
      )}

      <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8 lg:pt-12">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-12">
          {/* Flyer — top on mobile, sticky card on the right on desktop */}
          <aside className="lg:order-2 lg:sticky lg:top-12">{Flyer}</aside>

          {/* Content */}
          <div className="mt-7 lg:order-1 lg:mt-0">
            <div className="anim-rise flex items-center justify-between gap-3">
              {organizer ? (
                <Link
                  href={`/o/${organizer.handle}`}
                  className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-ink">
                    {organizer.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-cream">{organizer.name}</span>
                  {organizer.marketing_approved && <VerifiedBadge />}
                </Link>
              ) : (
                <span />
              )}
              <ShareButton title={event.title} />
            </div>

            <h1 className="anim-rise d-1 mt-6 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">
              {event.title}
            </h1>

            {/* Meta — Posh-style dividers */}
            <div className="anim-rise d-2 mt-6 space-y-3 border-y border-white/10 py-5">
              <div className="flex items-start gap-3">
                <CalendarIcon />
                <p className="font-medium text-cream">{fmtDate(event.starts_at, event.timezone)}</p>
              </div>
              <div className="flex items-start gap-3">
                <PinIcon />
                <div>
                  <p className="font-medium text-cream">{event.venue_name}</p>
                  <p className="text-sm text-mauve-dim">
                    {event.venue_address} · {event.city}, {event.state}
                  </p>
                </div>
              </div>
            </div>

            {promoter && (
              <div className="anim-rise d-2 flex items-center gap-3 border-b border-white/10 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-lg">🎟️</span>
                <div>
                  <p className="font-medium text-cream">Invited by {promoter.name}</p>
                  <p className="text-sm text-mauve-dim">Your spot’s reserved through their link.</p>
                </div>
              </div>
            )}

            {event.description && (
              <section className="anim-rise d-3 border-b border-white/10 py-6">
                <h2 className="mb-2 font-display font-semibold text-cream">About this event</h2>
                <p className="whitespace-pre-line leading-relaxed text-mauve-dim">{event.description}</p>
              </section>
            )}

            {/* Tickets (GA) */}
            {gaTiers.length > 0 && (
              <section className="anim-rise d-3 mt-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Tickets</h2>
                <ul className="space-y-2.5">
                  {gaTiers.map((t) => {
                    const st = tierStatus(t);
                    return (
                      <li
                        key={t.id}
                        className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors ${
                          st.available ? "border-white/10 bg-white/[0.03]" : "border-white/5 opacity-55"
                        }`}
                      >
                        <div>
                          <p className="font-display text-lg font-semibold text-cream">{t.name}</p>
                          {st.label && <p className="text-sm text-mauve-dim">{st.label}</p>}
                        </div>
                        <span className="font-display text-lg tabular-nums text-cream">{usd(t.price_cents)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Tables / bottle service — a tappable map */}
            {tableTiers.length > 0 && (
              <section className="anim-rise d-3 mt-8">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Tables</h2>
                <p className="mb-4 text-sm text-mauve-dim">Pick a table — it admits your whole party.</p>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 text-center text-[11px] uppercase tracking-[0.3em] text-mauve-dim/70">Stage</div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {tableTiers.map((t) => {
                      const st = tierStatus(t);
                      const inner = (
                        <div
                          className={`flex h-24 w-24 flex-col items-center justify-center rounded-2xl border text-center transition-colors ${
                            st.available
                              ? "border-gold/60 bg-gold/10 text-cream hover:border-gold hover:bg-gold/20"
                              : "border-white/10 text-mauve-dim opacity-55"
                          }`}
                        >
                          <span className="font-display text-sm font-semibold">{t.name}</span>
                          <span className="text-[11px] text-mauve-dim">{t.seats} guests</span>
                          <span className="mt-0.5 font-display text-sm tabular-nums">{usd(t.price_cents)}</span>
                        </div>
                      );
                      return onSale && st.available ? (
                        <Link key={t.id} href={tableHref(t.id)}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={t.id}>{inner}</div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {tiers.length === 0 && (
              <p className="anim-rise d-3 mt-6 rounded-2xl border border-white/10 px-5 py-4 text-mauve-dim">No tickets yet.</p>
            )}

            {onSale && allSoldOut && (
              <div className="mt-8">
                <WaitlistForm slug={event.slug} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky buy bar — pill button, Posh-style */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="leading-tight">
            {onSale && !allSoldOut ? (
              <>
                <p className="text-[11px] uppercase tracking-wide text-mauve-dim">From</p>
                <p className="font-display text-xl font-semibold tabular-nums text-cream">{usd(fromPrice)}</p>
              </>
            ) : (
              <p className="font-display text-lg font-semibold text-mauve-dim">
                {allSoldOut ? "Sold out" : "Not on sale"}
              </p>
            )}
          </div>
          {onSale && !allSoldOut ? (
            <Link
              href={checkoutHref}
              className="rounded-full bg-gold px-10 py-3.5 font-display text-base font-semibold text-ink shadow-lg shadow-gold/25 transition-colors hover:bg-gold-hi"
            >
              Get tickets
            </Link>
          ) : (
            <span className="rounded-full border border-white/15 px-10 py-3.5 font-display text-mauve-dim">
              {allSoldOut ? "Join waitlist ↑" : "Coming soon"}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
