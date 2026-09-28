import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPlaceBySlug, ensurePlaceGeocoded, type PlaceRecord } from "@/lib/places";
import { listPublishedStoriesForPlace } from "@/lib/stories";
import { listUpcomingEventsForPlace } from "@/lib/events";
import { isAdminViewer } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site";
import { placeCategoryLabel, sceneTagLabel } from "@/lib/taxonomy";
import { SiteHeader } from "@/app/components/SiteHeader";
import { EventMap } from "@/app/components/EventMap";
import { StoryCard } from "@/app/components/DiscoveryCards";
import { TrackView, TrackedLink } from "@/app/components/Track";
import { PlaceActions } from "./PlaceActions";

export const dynamic = "force-dynamic";

const LANGUAGE_LABEL = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);

function describe(p: PlaceRecord): string {
  return (p.short_description ?? p.about ?? `${placeCategoryLabel(p.category)} in ${p.city}, ${p.state}.`).slice(0, 180);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) return { title: "Place not found — Hapnin", robots: { index: false } };
  const title = `${place.name} — ${placeCategoryLabel(place.category)} in ${place.city} | Hapnin`;
  return {
    title,
    description: describe(place),
    alternates: { canonical: `/places/${place.slug}` },
    openGraph: {
      type: "website",
      url: `/places/${place.slug}`,
      siteName: "Hapnin",
      title: place.name,
      description: describe(place),
      ...(place.hero_image_url ? { images: [{ url: place.hero_image_url, alt: place.hero_image_alt ?? place.name }] } : {}),
    },
    twitter: { card: place.hero_image_url ? "summary_large_image" : "summary", title: place.name, description: describe(place) },
    ...(place.status !== "published" ? { robots: { index: false, follow: false } } : {}),
  };
}

function jsonLd(p: PlaceRecord, pin: { lat: number; lng: number } | null) {
  const sameAs = [p.website, p.instagram ? `https://www.instagram.com/${p.instagram}/` : null].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": p.category === "restaurant" ? "Restaurant" : "LocalBusiness",
    name: p.name,
    description: describe(p),
    url: absoluteUrl(`/places/${p.slug}`),
    ...(p.hero_image_url ? { image: [p.hero_image_url, ...p.gallery] } : {}),
    address: { "@type": "PostalAddress", ...(p.address ? { streetAddress: p.address } : {}), addressLocality: p.city, addressRegion: p.state, ...(p.zip ? { postalCode: p.zip } : {}), addressCountry: "US" },
    ...(pin ? { geo: { "@type": "GeoCoordinates", latitude: pin.lat, longitude: pin.lng } } : {}),
    ...(p.phone ? { telephone: p.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function fmtEventDate(ms: number) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" }).format(new Date(ms));
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) notFound();
  const admin = place.status !== "published" ? await isAdminViewer() : false;
  if (place.status !== "published" && !admin) notFound();

  const [stories, events, pin] = await Promise.all([listPublishedStoriesForPlace(place.id), listUpcomingEventsForPlace(place.id), ensurePlaceGeocoded(place)]);
  const tags = [...place.scene_tags.map(sceneTagLabel), ...place.custom_tags];
  const addressLine = [place.address, `${place.city}, ${place.state}${place.zip ? ` ${place.zip}` : ""}`].filter(Boolean).join(" · ");

  return (
    <main className="grain min-h-[100svh] pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(place, pin)).replace(/</g, "\\u003c") }} />
      <TrackView name="place_viewed" subject={{ place_id: place.id }} seen={{ kind: "place", id: place.id }} />

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <SiteHeader current="places" className="mb-8" />

        {place.status !== "published" && (
          <p className="mb-5 rounded-xl border border-coral/50 bg-coral/10 px-4 py-3 text-sm text-cream" role="note">
            <span className="font-semibold text-coral">Draft</span> — only admins can see this page until it&rsquo;s published.{" "}
            <Link href={`/admin/places/${place.id}`} className="text-gold hover:underline">Edit</Link>
          </p>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12">
          {/* Hero image — top on phones, sticky on the right on desktop */}
          <aside className="lg:order-2 lg:sticky lg:top-10">
            {place.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.hero_image_url} alt={place.hero_image_alt ?? `${place.name}`} className="aspect-[4/5] w-full rounded-3xl border border-white/10 object-cover shadow-2xl shadow-black/50" />
            ) : (
              <div className="aspect-[4/3] w-full rounded-3xl border border-white/10" style={{ backgroundImage: "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.35), rgba(242,89,63,0.18) 55%, rgba(27,10,42,0.6) 85%)" }} aria-hidden="true" />
            )}
          </aside>

          <div className="mt-7 lg:order-1 lg:mt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{placeCategoryLabel(place.category)} · {place.city}</p>
            <h1 className="mt-2 font-brand text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">{place.name}</h1>
            {place.short_description && <p className="mt-3 text-lg leading-relaxed text-mauve-dim">{place.short_description}</p>}

            {tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Cultural associations">
                {tags.map((t) => (
                  <li key={t} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-sm text-mauve-dim">{t}</li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              <PlaceActions placeId={place.id} name={place.name} website={place.website} instagram={place.instagram} phone={place.phone} address={place.address ? addressLine : null} lat={pin?.lat ?? null} lng={pin?.lng ?? null} />
            </div>

            {stories.length > 0 && (
              <section className="mt-10" aria-labelledby="itc">
                <h2 id="itc" className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Inside the Culture</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {stories.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            )}

            {place.about && (
              <section className="mt-10 border-t border-white/10 pt-6">
                <h2 className="mb-2 font-display font-semibold text-cream">About</h2>
                <p className="whitespace-pre-line leading-relaxed text-mauve-dim">{place.about}</p>
                {place.owner_display && <p className="mt-3 text-sm text-mauve-dim/80">{place.owner_display}</p>}
              </section>
            )}

            {place.offerings.length > 0 && (
              <section className="mt-8 border-t border-white/10 pt-6">
                <h2 className="mb-3 font-display font-semibold text-cream">What you&rsquo;ll find here</h2>
                <ul className="space-y-2">
                  {place.offerings.map((o) => (
                    <li key={o.name} className="flex gap-3">
                      <span className="mt-2 inline-block h-2 w-2 flex-none rotate-45 bg-gold" aria-hidden="true" />
                      <p className="text-mauve-dim"><span className="font-semibold text-cream">{o.name}</span>{o.details ? ` — ${o.details}` : ""}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(place.culture_note || place.languages.length > 0) && (
              <section className="mt-8 border-t border-white/10 pt-6">
                <h2 className="mb-2 font-display font-semibold text-cream">Cultural context</h2>
                {place.culture_note && <p className="whitespace-pre-line leading-relaxed text-mauve-dim">{place.culture_note}</p>}
                {place.languages.length > 0 && <p className="mt-2 text-sm text-mauve-dim/80">Languages: {place.languages.map(LANGUAGE_LABEL).join(", ")}</p>}
              </section>
            )}

            <section className="mt-8 border-t border-white/10 pt-6" aria-labelledby="upcoming">
              <h2 id="upcoming" className="mb-3 font-display font-semibold text-cream">Upcoming experiences</h2>
              {events.length === 0 ? (
                <p className="text-sm text-mauve-dim">Nothing scheduled here right now. <Link href="/discover" className="text-gold hover:underline">See what&rsquo;s on across Phoenix</Link>.</p>
              ) : (
                <ul className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id}>
                      <TrackedLink href={`/e/${e.slug}`} name="place_to_event_clicked" subject={{ place_id: place.id, event_id: e.id }} from={{ type: "place", id: place.id }} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-gold">
                        {e.flyer_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.flyer_url} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-xl object-cover" />
                        ) : (
                          <span className="h-16 w-16 flex-none rounded-xl bg-plum" aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-display font-semibold text-cream group-hover:text-gold">{e.title}</span>
                          <span className="block text-sm text-mauve-dim">{fmtEventDate(e.starts_at)}</span>
                        </span>
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {place.address && (
              <div className="mt-8">
                <EventMap lat={pin?.lat ?? null} lng={pin?.lng ?? null} label={place.name} address={addressLine} accent="#F4B24C" />
              </div>
            )}

            {place.gallery.length > 0 && (
              <section className="mt-8" aria-label="Gallery">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {place.gallery.map((g, i) => (
                    <li key={g}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g} alt={`${place.name} — photo ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-2xl border border-white/10 object-cover" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
