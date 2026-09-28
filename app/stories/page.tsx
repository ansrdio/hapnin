import Link from "next/link";
import type { Metadata } from "next";
import { listAllStories, listPublishedStories } from "@/lib/stories";
import { getPlacesByIds } from "@/lib/places";
import { isAdminViewer } from "@/lib/auth";
import { SiteHeader } from "@/app/components/SiteHeader";
import { StoryCard } from "@/app/components/DiscoveryCards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inside the Culture | Hapnin",
  description: "The people, places and stories behind the cultures around us — short films and features from Hapnin in Phoenix.",
  alternates: { canonical: "/stories" },
  openGraph: { title: "Inside the Culture | Hapnin", description: "The people, places and stories behind the cultures around us.", url: "/stories", siteName: "Hapnin", type: "website" },
};

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const admin = preview === "1" && (await isAdminViewer());
  const stories = admin ? await listAllStories() : await listPublishedStories();
  const places = await getPlacesByIds([...new Set(stories.map((s) => s.place_ids[0]).filter(Boolean))]);
  const placeName = new Map(places.filter((p) => admin || p.status === "published").map((p) => [p.id, p.name]));

  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto max-w-page px-5 py-8 sm:px-8 sm:py-10">
        <SiteHeader current="culture" className="mb-10" />
        <header className="anim-rise mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">A Hapnin series</p>
          <h1 className="mt-2 font-brand text-4xl font-bold text-cream sm:text-6xl">Inside the Culture</h1>
          <p className="mt-2 max-w-2xl text-mauve-dim">The people, places and stories behind the cultures around us.</p>
          {admin && <p className="mt-3 inline-block rounded-full bg-coral/15 px-3 py-1 text-sm text-coral">Admin preview — drafts included</p>}
        </header>

        {stories.length === 0 ? (
          <p className="rounded-2xl border border-white/10 px-5 py-8 text-center text-mauve-dim">
            The first episode is being filmed. Meanwhile, <Link href="/discover" className="text-gold hover:underline">see what&rsquo;s on</Link>.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => (
              <li key={s.id}>
                <StoryCard story={s} placeName={s.place_ids[0] ? placeName.get(s.place_ids[0]) : null} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
