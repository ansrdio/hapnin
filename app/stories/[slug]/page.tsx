import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStoryBySlug, type StoryRecord } from "@/lib/stories";
import { getPlacesByIds } from "@/lib/places";
import { getEventById, type EventRecord } from "@/lib/events";
import { isAdminViewer } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site";
import { parseVideoUrl } from "@/lib/video";
import { parseStoryBody } from "@/lib/story-body";
import { placeCategoryLabel, sceneTagLabel } from "@/lib/taxonomy";
import { SiteHeader } from "@/app/components/SiteHeader";
import { TrackView, TrackedLink } from "@/app/components/Track";
import { VideoFacade } from "@/app/components/VideoFacade";
import { storyThumb } from "@/app/components/DiscoveryCards";

export const dynamic = "force-dynamic";

const describe = (s: StoryRecord) => (s.subtitle ?? parseStoryBody(s.body).find((b) => b.kind === "paragraph")?.text ?? "Inside the Culture, from Hapnin.").slice(0, 180);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) return { title: "Story not found — Hapnin", robots: { index: false } };
  const image = storyThumb(story);
  return {
    title: `${story.title} — Inside the Culture | Hapnin`,
    description: describe(story),
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      type: story.video_url ? "video.other" : "article",
      url: `/stories/${story.slug}`,
      siteName: "Hapnin",
      title: story.title,
      description: describe(story),
      ...(image ? { images: [{ url: image, alt: story.hero_image_alt ?? story.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: story.title, description: describe(story) },
    ...(story.status !== "published" ? { robots: { index: false, follow: false } } : {}),
  };
}

function jsonLd(s: StoryRecord) {
  const video = parseVideoUrl(s.video_url);
  const image = storyThumb(s);
  const date = s.published_at ? new Date(s.published_at).toISOString() : undefined;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: s.title,
    description: describe(s),
    url: absoluteUrl(`/stories/${s.slug}`),
    ...(image ? { image } : {}),
    ...(date ? { datePublished: date } : {}),
    ...(s.author ? { author: { "@type": "Person", name: s.author } } : {}),
    publisher: { "@type": "Organization", name: "Hapnin", url: absoluteUrl("/") },
  };
  if (!video) return [article];
  return [
    article,
    { "@context": "https://schema.org", "@type": "VideoObject", name: s.title, description: describe(s), ...(image ? { thumbnailUrl: image } : {}), ...(date ? { uploadDate: date } : {}), embedUrl: video.embedUrl.split("?")[0], contentUrl: video.watchUrl },
  ];
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();
  const admin = story.status !== "published" ? await isAdminViewer() : false;
  if (story.status !== "published" && !admin) notFound();

  const [placesAll, eventsAll] = await Promise.all([getPlacesByIds(story.place_ids), Promise.all(story.event_ids.map((id) => getEventById(id)))]);
  const places = placesAll.filter((p) => p.status === "published" || admin);
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  const events = eventsAll.filter((e): e is EventRecord => !!e && e.status === "on_sale" && !e.is_sample && e.starts_at >= cutoff);
  const video = parseVideoUrl(story.video_url);
  const blocks = parseStoryBody(story.body);
  const tags = [...story.scene_tags.map(sceneTagLabel), ...story.custom_tags];

  return (
    <main className="grain min-h-[100svh] pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(story)).replace(/</g, "\\u003c") }} />
      <TrackView name="story_viewed" subject={{ story_id: story.id }} seen={{ kind: "story", id: story.id }} />

      <article className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <SiteHeader current="culture" className="mb-8" />

        {story.status !== "published" && (
          <p className="mb-5 rounded-xl border border-coral/50 bg-coral/10 px-4 py-3 text-sm text-cream" role="note">
            <span className="font-semibold text-coral">Draft</span> — only admins can see this story until it&rsquo;s published.{" "}
            <Link href={`/admin/stories/${story.id}`} className="text-gold hover:underline">Edit</Link>
          </p>
        )}

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          <Link href="/stories" className="hover:text-gold-hi">Hapnin: Inside the Culture</Link>
        </p>
        <h1 className="mt-2 font-brand text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">{story.title}</h1>
        {story.subtitle && <p className="mt-3 text-lg leading-relaxed text-mauve-dim">{story.subtitle}</p>}

        <div className="mt-6">
          {video ? (
            <VideoFacade embedUrl={video.embedUrl} thumbnailUrl={story.hero_image_url ?? video.thumbnailUrl} title={story.title} storyId={story.id} watchUrl={video.watchUrl} />
          ) : story.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.hero_image_url} alt={story.hero_image_alt ?? ""} className="aspect-video w-full rounded-3xl border border-white/10 object-cover" />
          ) : null}
        </div>

        {(tags.length > 0 || story.author || story.published_at) && (
          <p className="mt-4 text-sm text-mauve-dim/80">
            {[story.author ? `By ${story.author}` : null, story.published_at ? new Date(story.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }) : null, ...tags].filter(Boolean).join(" · ")}
          </p>
        )}

        {blocks.length > 0 && (
          <div className="mt-8 space-y-5">
            {blocks.map((b, i) =>
              b.kind === "heading" ? (
                <h2 key={i} className="pt-3 font-display text-2xl font-semibold text-cream">{b.text}</h2>
              ) : (
                <p key={i} className="whitespace-pre-line text-lg leading-relaxed text-mauve-dim">{b.text}</p>
              )
            )}
          </div>
        )}

        {places.map((p) => (
          <section key={p.id} className="mt-10 overflow-hidden rounded-3xl border border-gold/30 bg-plum/50" aria-label={`About ${p.name}`}>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              {p.hero_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.hero_image_url} alt="" loading="lazy" className="h-24 w-24 flex-none rounded-2xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{placeCategoryLabel(p.category)} · {p.city}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-cream">{p.name}</p>
                {p.short_description && <p className="mt-1 text-sm text-mauve-dim">{p.short_description}</p>}
              </div>
            </div>
            <TrackedLink href={`/places/${p.slug}`} name="story_to_place_clicked" subject={{ story_id: story.id, place_id: p.id }} from={{ type: "story", id: story.id }} className="block bg-gold px-6 py-4 text-center font-display text-lg font-semibold text-ink transition-colors hover:bg-gold-hi">
              Discover {p.name} on Hapnin
            </TrackedLink>
          </section>
        ))}

        {events.length > 0 && (
          <section className="mt-10" aria-labelledby="related">
            <h2 id="related" className="mb-3 font-display font-semibold text-cream">Experience it</h2>
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <TrackedLink href={`/e/${e.slug}`} name="story_to_event_clicked" subject={{ story_id: story.id, event_id: e.id }} from={{ type: "story", id: story.id }} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-gold">
                    {e.flyer_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.flyer_url} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-xl object-cover" />
                    ) : (
                      <span className="h-16 w-16 flex-none rounded-xl bg-plum" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-display font-semibold text-cream group-hover:text-gold">{e.title}</span>
                      <span className="block text-sm text-mauve-dim">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" }).format(new Date(e.starts_at))}</span>
                    </span>
                  </TrackedLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
