import Link from "next/link";
import type { Metadata } from "next";
import { listOnSaleEvents, getTiers, type EventRecord } from "@/lib/events";
import { money } from "@/app/components/ui";
import { Filters } from "./Filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What's hapnin",
  description: "African events near you — afrobeats, amapiano, Nollywood, comedy, culture. Phoenix first.",
};

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fromPrice(e: EventRecord): Promise<number | null> {
  const tiers = (await getTiers(e.id)).filter((t) => t.is_active);
  return tiers.length ? Math.min(...tiers.map((t) => t.price_cents)) : null;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; type?: string }>;
}) {
  const { city = "all", type = "all" } = await searchParams;
  const all = await listOnSaleEvents();
  const cities = [...new Set(all.map((e) => e.city))].sort();
  const events = all.filter(
    (e) => (city === "all" || e.city === city) && (type === "all" || e.event_type === type)
  );
  const prices = await Promise.all(events.map(fromPrice));

  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto max-w-page px-5 py-12 sm:px-8 sm:py-16">
        <header className="anim-rise mb-8">
          <Link href="/" className="text-sm text-mauve-dim transition-colors hover:text-cream">← Hapnin</Link>
          <h1 className="mt-2 font-display text-4xl font-bold text-cream sm:text-6xl">What&rsquo;s hapnin</h1>
          <p className="mt-1 text-mauve-dim">African events in Phoenix — and wherever you are next.</p>
        </header>

        <div className="anim-rise d-1 mb-8">
          <Filters cities={cities} city={city} type={type} />
        </div>

        {events.length === 0 ? (
          <p className="rounded-2xl border border-plum-hi bg-plum/40 p-8 text-mauve-dim">
            {all.length === 0 ? (
              <>Nothing on sale right now. Check back soon — or <Link href="/create" className="text-gold hover:underline">throw one yourself</Link>.</>
            ) : (
              <>No events match that. Try a different type or city.</>
            )}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {events.map((e, i) => (
              <li key={e.id} className="anim-rise" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                <Link href={`/e/${e.slug}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-plum/50">
                    {e.flyer_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.flyer_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          backgroundImage:
                            "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.30), rgba(242,89,63,0.16) 55%, transparent 85%)",
                        }}
                      />
                    )}
                    {prices[i] != null && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-gold backdrop-blur">
                        {prices[i] === 0 ? "Free" : `From ${money(prices[i]!)}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 font-display text-base font-semibold leading-tight text-cream group-hover:text-gold">
                    {e.title}
                  </p>
                  <p className="mt-0.5 text-sm text-mauve-dim">{fmtDate(e.starts_at)}</p>
                  <p className="truncate text-sm text-mauve-dim">
                    {e.venue_name} · {e.city}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
