import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrganizerByHandle } from "@/lib/organizers";
import { listEventsByOrganizer, getTiers, type EventRecord } from "@/lib/events";
import { money } from "@/app/components/ui";

export const dynamic = "force-dynamic";

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

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const organizer = await getOrganizerByHandle(handle);
  if (!organizer) return { title: "Not found · Hapnin" };
  return {
    title: `${organizer.name} · Hapnin`,
    description: `Upcoming events by ${organizer.name} on Hapnin.`,
  };
}

async function fromPrice(event: EventRecord): Promise<number | null> {
  const tiers = await getTiers(event.id);
  const active = tiers.filter((t) => t.is_active);
  if (active.length === 0) return null;
  return Math.min(...active.map((t) => t.price_cents));
}

export default async function OrganizerPublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const organizer = await getOrganizerByHandle(handle);
  if (!organizer) notFound();

  const all = await listEventsByOrganizer(organizer.id);
  const live = all.filter((e) => e.status === "on_sale").sort((a, b) => a.starts_at - b.starts_at);
  const prices = await Promise.all(live.map(fromPrice));

  return (
    <main className="grain mx-auto max-w-3xl px-5 py-14 sm:py-20">
      {/* Identity */}
      <header className="anim-rise mb-12">
        <div className="anim-bloom flex h-20 w-20 items-center justify-center rounded-3xl bg-gold font-display text-3xl font-bold text-ink shadow-lg shadow-gold/20">
          {organizer.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="masthead-shadow mt-5 font-display text-4xl font-bold text-cream sm:text-5xl">
          {organizer.name}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-mauve-dim">
          {organizer.marketing_approved && (
            <span className="inline-flex items-center gap-1 text-sm text-gold">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.2 1.6 2.7-.2 1 2.5 2.3 1.5-.7 2.6.7 2.6-2.3 1.5-1 2.5-2.7-.2L12 22l-2.2-1.6-2.7.2-1-2.5-2.3-1.5.7-2.6L3.8 11l2.3-1.5 1-2.5 2.7.2L12 2z" />
              </svg>
              Verified
            </span>
          )}
          {organizer.instagram_handle && (
            <a
              href={`https://instagram.com/${organizer.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm transition-colors hover:text-cream"
            >
              @{organizer.instagram_handle}
            </a>
          )}
        </div>
      </header>

      {/* Events */}
      <h2 className="anim-rise d-1 mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Upcoming events</h2>
      {live.length === 0 ? (
        <p className="anim-rise d-1 rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">
          No events on sale right now. Check back soon.
        </p>
      ) : (
        <ul className="space-y-4">
          {live.map((e, i) => (
            <li key={e.id} className="anim-rise d-2">
              <Link
                href={`/e/${e.slug}`}
                className="group flex gap-4 overflow-hidden rounded-3xl border border-plum-hi bg-plum/40 transition-all hover:border-gold"
              >
                <div className="relative h-36 w-28 shrink-0 overflow-hidden bg-ink/50">
                  {e.flyer_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.flyer_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center py-4 pr-5">
                  <p className="font-display text-xl font-semibold text-cream">{e.title}</p>
                  <p className="mt-1 text-sm text-mauve-dim">{fmtDate(e.starts_at)}</p>
                  <p className="text-sm text-mauve-dim">
                    {e.venue_name} · {e.city}, {e.state}
                  </p>
                  {prices[i] != null && (
                    <p className="mt-2 font-display text-sm font-semibold text-gold">
                      {prices[i] === 0 ? "Free" : `From ${money(prices[i]!)}`}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-20 text-center text-xs text-mauve-dim/70">
        Powered by <Link href="/" className="text-mauve-dim hover:text-cream">Hapnin</Link>
      </footer>
    </main>
  );
}
