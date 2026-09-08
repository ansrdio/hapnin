import Link from "next/link";
import type { Metadata } from "next";
import { listOnSaleEvents, getTiers } from "@/lib/events";
import { DiscoverClient, type Card } from "./DiscoverClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What's hapnin",
  description: "African events near you — afrobeats, amapiano, Nollywood, comedy, culture. Phoenix first.",
};

export default async function DiscoverPage() {
  const events = await listOnSaleEvents();
  const cards: Card[] = await Promise.all(
    events.map(async (e) => {
      const tiers = (await getTiers(e.id)).filter((t) => t.is_active);
      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        city: e.city,
        venue_name: e.venue_name,
        starts_at: e.starts_at,
        flyer_url: e.flyer_url,
        event_type: e.event_type,
        from_cents: tiers.length ? Math.min(...tiers.map((t) => t.price_cents)) : null,
        free: tiers.some((t) => t.price_cents === 0),
        talent: e.talent,
      };
    })
  );
  const cities = [...new Set(events.map((e) => e.city))].sort();

  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto max-w-page px-5 py-12 sm:px-8 sm:py-16">
        <header className="anim-rise mb-8">
          <Link href="/" className="text-sm text-mauve-dim transition-colors hover:text-cream">← Hapnin</Link>
          <h1 className="mt-2 font-display text-4xl font-bold text-cream sm:text-6xl">What&rsquo;s hapnin</h1>
          <p className="mt-1 text-mauve-dim">African events in Phoenix — and wherever you are next.</p>
        </header>

        <DiscoverClient cards={cards} cities={cities} />
      </div>
    </main>
  );
}
