import Link from "next/link";
import { placeCategoryLabel, sceneTagLabel } from "@/lib/taxonomy";
import type { PlaceRecord } from "@/lib/places";
import type { StoryRecord } from "@/lib/stories";
import { parseVideoUrl } from "@/lib/video";

// Place and story cards — the same shape and type ramp as the Discover event
// cards, so the three read as one product.

const GRADIENT = { backgroundImage: "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.30), rgba(242,89,63,0.16) 55%, transparent 85%)" };

export function PlaceCard({ place }: { place: PlaceRecord }) {
  const tags = [...place.scene_tags.map(sceneTagLabel), ...place.custom_tags].slice(0, 3);
  return (
    <Link href={`/places/${place.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-plum/50">
        {place.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.hero_image_url} alt={place.hero_image_alt ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full" style={GRADIENT} />
        )}
        {place.status === "draft" && <span className="absolute left-2 top-2 rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-ink">Draft</span>}
      </div>
      <p className="mt-2.5 font-display text-base font-semibold leading-tight text-cream group-hover:text-gold">{place.name}</p>
      <p className="mt-0.5 text-sm text-mauve-dim">{placeCategoryLabel(place.category)} · {place.city}</p>
      {tags.length > 0 && <p className="mt-1 truncate text-xs text-mauve-dim/80">{tags.join(" · ")}</p>}
      {place.short_description && <p className="mt-1 line-clamp-2 text-sm text-mauve-dim">{place.short_description}</p>}
    </Link>
  );
}

export function storyThumb(story: StoryRecord): string | null {
  return story.hero_image_url ?? parseVideoUrl(story.video_url)?.thumbnailUrl ?? null;
}

export function StoryCard({ story, placeName }: { story: StoryRecord; placeName?: string | null }) {
  const thumb = storyThumb(story);
  const tags = [...story.scene_tags.map(sceneTagLabel), ...story.custom_tags].slice(0, 3);
  return (
    <Link href={`/stories/${story.slug}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-plum/50">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={story.hero_image_alt ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full" style={GRADIENT} />
        )}
        {story.video_url && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-gold backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            Watch
          </span>
        )}
        {story.status === "draft" && <span className="absolute left-2 top-2 rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-ink">Draft</span>}
      </div>
      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Inside the Culture{placeName ? ` · ${placeName}` : ""}</p>
      <p className="mt-1 font-display text-lg font-semibold leading-tight text-cream group-hover:text-gold">{story.title}</p>
      {story.subtitle && <p className="mt-1 line-clamp-2 text-sm text-mauve-dim">{story.subtitle}</p>}
      <p className="mt-1 truncate text-xs text-mauve-dim/80">
        {tags.join(" · ")}
        {story.published_at && <>{tags.length ? " · " : ""}{new Date(story.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" })}</>}
      </p>
    </Link>
  );
}
