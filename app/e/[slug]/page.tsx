import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug, getTiers, type Tier } from "@/lib/events";
import { resolvePromoterCode } from "@/lib/promoters";

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
  };
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

  const tiers = await getTiers(event.id);
  const onSale = event.status === "on_sale";
  const allSoldOut = tiers.length > 0 && tiers.every((t) => !tierStatus(t).available);

  // Promoter attribution — validate the code so we only forward/celebrate real ones.
  const promoter = p ? await resolvePromoterCode(event.id, p) : null;
  const checkoutHref = promoter ? `/e/${event.slug}/checkout?p=${promoter.code}` : `/e/${event.slug}/checkout`;

  return (
    <main className="grain min-h-[100svh]">
      {/* Flyer — full-bleed when present, lazy-loaded; type-led otherwise */}
      {event.flyer_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.flyer_url}
          alt=""
          loading="lazy"
          className="h-[46svh] w-full object-cover sm:h-[56svh]"
        />
      ) : (
        <div
          className="flex h-[38svh] items-end sm:h-[46svh]"
          style={{
            backgroundImage:
              "radial-gradient(90% 80% at 50% 0%, rgba(244,178,76,0.28), rgba(242,89,63,0.14) 55%, transparent 80%)",
          }}
          aria-hidden="true"
        />
      )}

      <div className="mx-auto max-w-2xl px-5 pb-24 pt-8 sm:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-gold">
          {event.city}, {event.state}
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-[1.02] text-cream sm:text-6xl">
          {event.title}
        </h1>

        <div className="mt-6 space-y-1 text-lg text-mauve-dim">
          <p className="text-cream">{fmtDate(event.starts_at, event.timezone)}</p>
          <p>
            {event.venue_name} · {event.venue_address}
          </p>
        </div>

        {promoter && (
          <p className="mt-6 inline-block rounded-full border border-gold/40 bg-gold/5 px-4 py-1.5 text-sm text-gold">
            Invited by {promoter.name}
          </p>
        )}

        {event.description && (
          <p className="mt-6 whitespace-pre-line leading-relaxed text-mauve-dim">{event.description}</p>
        )}

        {/* Tiers */}
        <div className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-gold">Tickets</h2>
          <ul className="mt-4 divide-y divide-plum-hi rounded-2xl border border-plum-hi">
            {tiers.map((t) => {
              const st = tierStatus(t);
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${st.available ? "" : "opacity-45"}`}
                >
                  <div>
                    <p className="font-display text-lg font-semibold text-cream">{t.name}</p>
                    {st.label && <p className="text-sm text-mauve-dim">{st.label}</p>}
                  </div>
                  <span className="font-display text-lg tabular-nums text-cream">{usd(t.price_cents)}</span>
                </li>
              );
            })}
            {tiers.length === 0 && <li className="px-5 py-4 text-mauve-dim">No tickets yet.</li>}
          </ul>
        </div>
      </div>

      {/* Sticky Get Tickets */}
      <div className="fixed inset-x-0 bottom-0 border-t border-plum-hi bg-ink/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <span className="text-sm text-mauve-dim">
            {onSale ? (allSoldOut ? "Sold out" : "Phoenix") : "Not on sale"}
          </span>
          {onSale && !allSoldOut ? (
            <Link
              href={checkoutHref}
              className="rounded-xl bg-gold px-7 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi"
            >
              Get tickets
            </Link>
          ) : (
            <span className="rounded-xl border border-plum-hi px-7 py-3.5 font-display text-mauve-dim">
              {allSoldOut ? "Sold out" : "Coming soon"}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
