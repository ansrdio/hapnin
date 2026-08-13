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
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      {/* Identity */}
      <header className="mb-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plum font-display text-2xl font-bold text-gold">
          {organizer.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold text-cream sm:text-4xl">{organizer.name}</h1>
        {organizer.instagram_handle && (
          <a
            href={`https://instagram.com/${organizer.instagram_handle}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-mauve-dim transition-colors hover:text-cream"
          >
            @{organizer.instagram_handle}
          </a>
        )}
      </header>

      {/* Events */}
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Upcoming events</h2>
      {live.length === 0 ? (
        <p className="rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">
          No events on sale right now. Check back soon.
        </p>
      ) : (
        <ul className="space-y-4">
          {live.map((e, i) => (
            <li key={e.id}>
              <Link
                href={`/e/${e.slug}`}
                className="flex gap-4 overflow-hidden rounded-2xl border border-plum-hi bg-plum/40 transition-colors hover:border-gold"
              >
                <div className="relative h-32 w-28 shrink-0 bg-ink/50">
                  {e.flyer_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.flyer_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center py-4 pr-4">
                  <p className="font-display text-lg font-semibold text-cream">{e.title}</p>
                  <p className="mt-0.5 text-sm text-mauve-dim">{fmtDate(e.starts_at)}</p>
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

      <footer className="mt-16 text-center text-xs text-mauve-dim/70">
        Powered by <Link href="/" className="text-mauve-dim hover:text-cream">Hapnin</Link>
      </footer>
    </main>
  );
}
