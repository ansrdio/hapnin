// Admin form → Story fields. Pure; unit-tested. Event references are entered
// as event links or slugs and resolved to ids server-side.

import { cleanText, type FieldErrors } from "./validation.ts";
import { normalizeSceneTags, parseCustomTags, type SceneTag } from "./taxonomy.ts";
import { parseVideoUrl } from "./video.ts";
import { slugifyName, httpsImageUrl } from "./place-input.ts";

export type StoryValues = {
  title: string;
  slug: string;
  subtitle: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  video_url: string | null;
  body: string | null;
  place_ids: string[];
  /** Raw event links/slugs as typed; the action resolves them to event ids. */
  event_refs: string[];
  scene_tags: SceneTag[];
  custom_tags: string[];
  author: string | null;
  featured: boolean;
};

export const MAX_STORY_PLACES = 5;
export const MAX_STORY_EVENTS = 10;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** "https://www.hapnin.now/e/taste-of-nigeria?x=1" | "/e/taste-of-nigeria" | "taste-of-nigeria" → "taste-of-nigeria". */
export function eventSlugFromRef(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/\/e\/([a-z0-9][a-z0-9-]{0,80})/i);
  const slug = (m ? m[1] : s).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug) ? slug : null;
}

export function parseStoryForm(formData: FormData): { values: Partial<StoryValues>; fieldErrors: FieldErrors } {
  const s = (k: string) => String(formData.get(k) ?? "");
  const title = cleanText(s("title"), 140);
  const slug = slugifyName(s("slug") || title);
  const hero = httpsImageUrl(s("hero_image_url"));
  const videoRaw = s("video_url").trim();
  const video = videoRaw ? parseVideoUrl(videoRaw) : null;
  const place_ids = [...new Set(formData.getAll("place_ids").map(String).filter((p) => ID.test(p)))];
  const eventLines = s("event_refs").split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
  const event_refs = [...new Set(eventLines.map(eventSlugFromRef).filter((x): x is string => !!x))];
  const custom = parseCustomTags(formData.getAll("custom_tags").flatMap((v) => String(v).split(",")));

  const fieldErrors: FieldErrors = {};
  if (!title) fieldErrors.title = "Required.";
  if (!slug) fieldErrors.slug = "Letters, numbers and hyphens (2–60).";
  if (hero === undefined) fieldErrors.hero_image_url = "Upload an image or paste an https:// link.";
  if (videoRaw && !video) fieldErrors.video_url = "A YouTube or Vimeo link.";
  if (place_ids.length > MAX_STORY_PLACES) fieldErrors.place_ids = `Up to ${MAX_STORY_PLACES} places.`;
  if (eventLines.length !== event_refs.length) fieldErrors.event_refs = "One event link or slug per line.";
  if (event_refs.length > MAX_STORY_EVENTS) fieldErrors.event_refs = `Up to ${MAX_STORY_EVENTS} events.`;
  if (custom.error) fieldErrors.custom_tags = custom.error;

  return {
    values: {
      title,
      slug: slug ?? undefined,
      subtitle: cleanText(s("subtitle"), 240) || null,
      hero_image_url: hero ?? null,
      hero_image_alt: cleanText(s("hero_image_alt"), 200) || null,
      video_url: video ? video.watchUrl : null,
      body: (s("body").replace(/\r\n?/g, "\n").trim().slice(0, 20000)) || null,
      place_ids: place_ids.slice(0, MAX_STORY_PLACES),
      event_refs: event_refs.slice(0, MAX_STORY_EVENTS),
      scene_tags: normalizeSceneTags(formData.getAll("scene_tags").map(String)),
      custom_tags: custom.tags,
      author: cleanText(s("author"), 80) || null,
      featured: formData.get("featured") === "on",
    },
    fieldErrors,
  };
}
