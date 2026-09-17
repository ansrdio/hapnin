import Link from "next/link";
import type { Metadata } from "next";
import { listOnSaleEvents, getTiers } from "@/lib/events";
import { DiscoverClient, type Card } from "./DiscoverClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events in Phoenix | Hapnin",
  description:
    "Discover what’s happening in Phoenix, starting with the city’s African diaspora event scene. Find nightlife, day parties, film, comedy, festivals and more.",
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
        category: e.category,
        scene_tags: e.scene_tags,
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
          <h1 className="mt-2 font-brand text-4xl font-bold text-cream sm:text-6xl">What&rsquo;s hapnin in Phoenix</h1>
          <p className="mt-1 text-mauve-dim">Starting with Phoenix&rsquo;s African diaspora scene.</p>
        </header>

        <DiscoverClient cards={cards} cities={cities} />
      </div>
    </main>
  );
}
