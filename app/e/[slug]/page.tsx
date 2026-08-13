import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug, getTiers, type Tier } from "@/lib/events";
import { getOrganizerById } from "@/lib/organizers";
import { resolvePromoterCode } from "@/lib/promoters";
import { WaitlistForm } from "./WaitlistForm";

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
  const onSale = event.status === "on_sale";
  const allSoldOut = tiers.length > 0 && tiers.every((t) => !tierStatus(t).available);

  const priceable = tiers.filter((t) => tierStatus(t).available);
  const minPrice = (priceable.length ? priceable : tiers).reduce((m, t) => Math.min(m, t.price_cents), Infinity);
  const fromPrice = Number.isFinite(minPrice) ? minPrice : 0;

  // Promoter attribution — validate the code so we only forward/celebrate real ones.
  const promoter = p ? await resolvePromoterCode(event.id, p) : null;
  const checkoutHref = promoter ? `/e/${event.slug}/checkout?p=${promoter.code}` : `/e/${event.slug}/checkout`;

  return (
    <main className="grain relative min-h-[100svh] pb-28">
      {/* Flyer hero, fading into the ground */}
      {event.flyer_url ? (
        <div className="anim-bloom relative h-[58svh] w-full overflow-hidden sm:h-[62svh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.flyer_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 to-transparent" />
        </div>
      ) : (
        <div
          className="h-[32svh] w-full sm:h-[40svh]"
          style={{
            backgroundImage:
              "radial-gradient(90% 80% at 50% 0%, rgba(244,178,76,0.30), rgba(242,89,63,0.15) 55%, transparent 80%)",
          }}
          aria-hidden="true"
        />
      )}

      <div className={`relative mx-auto max-w-2xl px-5 sm:px-8 ${event.flyer_url ? "-mt-24 sm:-mt-28" : "pt-6"}`}>
        {/* Organizer */}
        {organizer && (
          <Link
            href={`/o/${organizer.handle}`}
            className="anim-rise d-1 inline-flex items-center gap-2.5 rounded-full border border-plum-hi bg-plum/60 py-1.5 pl-1.5 pr-4 backdrop-blur transition-colors hover:border-gold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-ink">
              {organizer.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-cream">{organizer.name}</span>
            {organizer.marketing_approved && <VerifiedBadge />}
          </Link>
        )}

        <p className="anim-rise d-1 mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
          {event.city}, {event.state}
        </p>
        <h1 className="anim-rise d-2 masthead-shadow mt-2 font-display text-4xl font-bold leading-[1.03] text-cream sm:text-6xl">
          {event.title}
        </h1>

        {/* Meta card */}
        <div className="anim-rise d-3 mt-7 space-y-3.5 rounded-2xl border border-plum-hi bg-plum/40 p-5 backdrop-blur">
          <div className="flex items-start gap-3">
            <CalendarIcon />
            <p className="font-medium text-cream">{fmtDate(event.starts_at, event.timezone)}</p>
          </div>
          <div className="flex items-start gap-3">
            <PinIcon />
            <div>
              <p className="font-medium text-cream">{event.venue_name}</p>
              <p className="text-sm text-mauve-dim">{event.venue_address}</p>
            </div>
          </div>
        </div>

        {promoter && (
          <p className="anim-rise d-3 mt-5 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-4 py-1.5 text-sm text-gold">
            <span className="text-base">🎟️</span> Invited by {promoter.name}
          </p>
        )}

        {event.description && (
          <section className="anim-rise d-4 mt-9">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">About</h2>
            <p className="whitespace-pre-line leading-relaxed text-mauve-dim">{event.description}</p>
          </section>
        )}

        {/* Tiers */}
        <section className="anim-rise d-4 mt-9">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Tickets</h2>
          <ul className="space-y-2.5">
            {tiers.map((t) => {
              const st = tierStatus(t);
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors ${
                    st.available ? "border-plum-hi bg-plum/40" : "border-plum-hi/60 bg-plum/20 opacity-55"
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
            {tiers.length === 0 && (
              <li className="rounded-2xl border border-plum-hi px-5 py-4 text-mauve-dim">No tickets yet.</li>
            )}
          </ul>

          {onSale && allSoldOut && <WaitlistForm slug={event.slug} />}
        </section>
      </div>

      {/* Sticky buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-plum-hi bg-ink/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
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
              className="rounded-xl bg-gold px-8 py-3.5 font-display text-base font-semibold text-ink shadow-lg shadow-gold/20 transition-colors hover:bg-gold-hi"
            >
              Get tickets
            </Link>
          ) : (
            <span className="rounded-xl border border-plum-hi px-8 py-3.5 font-display text-mauve-dim">
              {allSoldOut ? "Join waitlist ↑" : "Coming soon"}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
