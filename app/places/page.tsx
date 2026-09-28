import Link from "next/link";
import type { Metadata } from "next";
import { listAllPlaces, listPublishedPlaces } from "@/lib/places";
import { isAdminViewer } from "@/lib/auth";
import { SiteHeader } from "@/app/components/SiteHeader";
import { PlaceCard } from "@/app/components/DiscoveryCards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Places to discover in Phoenix | Hapnin",
  description: "Culturally rooted restaurants, studios, designers, creative spaces and community organizations in Phoenix — the places that bring our cultures to life.",
  alternates: { canonical: "/places" },
  openGraph: { title: "Places to discover | Hapnin", description: "The places that bring our cultures to life in Phoenix.", url: "/places", siteName: "Hapnin", type: "website" },
};

export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const admin = preview === "1" && (await isAdminViewer());
  const places = admin ? await listAllPlaces() : await listPublishedPlaces();

  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto max-w-page px-5 py-8 sm:px-8 sm:py-10">
        <SiteHeader current="places" className="mb-10" />
        <header className="anim-rise mb-8">
          <h1 className="font-brand text-4xl font-bold text-cream sm:text-6xl">Places to discover</h1>
          <p className="mt-2 max-w-2xl text-mauve-dim">The restaurants, studios, designers, creative spaces and community organizations that bring our cultures to life in Phoenix.</p>
          {admin && <p className="mt-3 inline-block rounded-full bg-coral/15 px-3 py-1 text-sm text-coral">Admin preview — drafts included</p>}
        </header>

        {places.length === 0 ? (
          <p className="rounded-2xl border border-white/10 px-5 py-8 text-center text-mauve-dim">
            The first places are on their way. Meanwhile, <Link href="/discover" className="text-gold hover:underline">see what&rsquo;s on</Link>.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {places.map((p) => (
              <li key={p.id}>
                <PlaceCard place={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
