// Event taxonomy — the one place the vocabulary lives. Client-safe (no
// server-only): forms, Discover and the migration script all read from here.
//
// Two layers, kept deliberately separate:
//   category    — "what kind of event is this?"  Exactly one per event.
//   scene_tags  — the scene, culture, sound or format the EVENT is built around.
//                 Zero or more. They describe the event, never the people who
//                 buy tickets to it.
//
// Firestore stores the stable ids (e.g. "pan_african"); the labels here are
// presentation only and can change freely. Adding an id is safe; changing an
// existing id's meaning after data exists is not.

export type Category = (typeof CATEGORIES)[number]["id"];
export type SceneTag = (typeof SCENE_TAGS)[number]["id"];
export type SceneGroup = "music" | "culture" | "format";

export const CATEGORIES = [
  { id: "nightlife", label: "Nightlife & Parties", short: "Nightlife" },
  { id: "live_music", label: "Live Music", short: "Live music" },
  { id: "film", label: "Film & Screening", short: "Film" },
  { id: "comedy", label: "Comedy", short: "Comedy" },
  { id: "culture", label: "Culture & Community", short: "Culture" },
  { id: "business", label: "Business, Conference & Networking", short: "Networking" },
  { id: "faith", label: "Faith & Gospel", short: "Faith" },
  { id: "food", label: "Food & Experience", short: "Food" },
  { id: "festival", label: "Festival", short: "Festivals" },
  { id: "other", label: "Other", short: "Other" },
] as const;

export const SCENE_TAGS = [
  // Music / scene
  { id: "afrobeats", label: "Afrobeats", group: "music" },
  { id: "amapiano", label: "Amapiano", group: "music" },
  { id: "afro_house", label: "Afro-house", group: "music" },
  { id: "highlife", label: "Highlife", group: "music" },
  { id: "dancehall", label: "Dancehall", group: "music" },
  { id: "soca", label: "Soca", group: "music" },
  { id: "rnb", label: "R&B", group: "music" },
  { id: "hip_hop", label: "Hip-hop", group: "music" },
  { id: "gospel", label: "Gospel", group: "music" },
  { id: "alte", label: "Alté", group: "music" },
  { id: "fuji", label: "Fuji", group: "music" },
  // Culture / community — the scene an event is built around
  { id: "nigerian", label: "Nigerian", group: "culture" },
  { id: "ghanaian", label: "Ghanaian", group: "culture" },
  { id: "south_african", label: "South African", group: "culture" },
  { id: "ethiopian", label: "Ethiopian", group: "culture" },
  { id: "kenyan", label: "Kenyan", group: "culture" },
  { id: "caribbean", label: "Caribbean", group: "culture" },
  { id: "jamaican", label: "Jamaican", group: "culture" },
  { id: "trinidadian", label: "Trinidadian", group: "culture" },
  { id: "pan_african", label: "Pan-African", group: "culture" },
  // Format
  { id: "day_party", label: "Day Party", group: "format" },
  { id: "owambe", label: "Owambe", group: "format" },
  { id: "nollywood", label: "Nollywood", group: "format" },
  { id: "documentary", label: "Documentary", group: "format" },
  { id: "standup", label: "Stand-up", group: "format" },
  { id: "independence", label: "Independence", group: "format" },
  { id: "homecoming", label: "Homecoming", group: "format" },
  { id: "young_professionals", label: "Young Professionals", group: "format" },
  { id: "students", label: "Students", group: "format" },
] as const satisfies readonly { id: string; label: string; group: SceneGroup }[];

export const SCENE_GROUP_LABELS: Record<SceneGroup, string> = {
  music: "Music & scene",
  culture: "Culture & community",
  format: "Format",
};

export const MAX_SCENE_TAGS = 8;

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const TAG_IDS = new Set<string>(SCENE_TAGS.map((t) => t.id));

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && CATEGORY_IDS.has(v);
}
export function isSceneTag(v: unknown): v is SceneTag {
  return typeof v === "string" && TAG_IDS.has(v);
}
export function categoryLabel(id: string, short = false): string {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? (short ? c.short : c.label) : id;
}
export function sceneTagLabel(id: string): string {
  return SCENE_TAGS.find((t) => t.id === id)?.label ?? id;
}
/** Validate + de-duplicate a list of raw tag ids (form input, migration, API). Order preserved. */
export function normalizeSceneTags(raw: unknown): SceneTag[] {
  const out: SceneTag[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (isSceneTag(v) && !out.includes(v)) out.push(v);
    if (out.length >= MAX_SCENE_TAGS) break;
  }
  return out;
}

// ── Custom tags ──────────────────────────────────────────────────────────────
// Organizer-authored, event-scoped strings alongside the canonical scene tags.
// Kept as the organizer typed them (after whitespace cleanup) — we never
// rewrite their spelling; anything we can't accept is a validation error.
// They never become Discover filters and are never auto-promoted to canonical.

export const CUSTOM_TAG_MAX = 3;
export const CUSTOM_TAG_MIN_LEN = 2;
export const CUSTOM_TAG_MAX_LEN = 24;
// Unicode letters and marks (accents, diacritics), digits, spaces, and & ' ’ - .
const CUSTOM_TAG_CHARS = /^[\p{L}\p{M}\p{N} &'’.\-]+$/u;

/** The form used for collision checks: case, spaces, hyphens, underscores and repeated separators collapse. */
export function tagKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-]+/g, " ").trim();
}
const CANONICAL_KEYS = new Set<string>(SCENE_TAGS.flatMap((t) => [tagKey(t.id), tagKey(t.label)]));

export type CustomTagResult = { ok: true; value: string } | { ok: false; error: string };

/** Clean whitespace only; validate everything else. Never mutates the organizer's letters. */
export function normalizeCustomTag(raw: string): CustomTagResult {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < CUSTOM_TAG_MIN_LEN) return { ok: false, error: `Tags need at least ${CUSTOM_TAG_MIN_LEN} characters.` };
  if (value.length > CUSTOM_TAG_MAX_LEN) return { ok: false, error: `Tags can be up to ${CUSTOM_TAG_MAX_LEN} characters.` };
  if (!CUSTOM_TAG_CHARS.test(value)) return { ok: false, error: "Letters, numbers, spaces, & ' - and . only." };
  if (CANONICAL_KEYS.has(tagKey(value))) return { ok: false, error: `“${value}” is already a Hapnin tag — pick it from the list instead.` };
  return { ok: true, value };
}

/** The canonical tag a typed string collides with, if any (for the picker to offer it instead). */
export function canonicalFor(raw: string): SceneTag | null {
  const k = tagKey(raw);
  return SCENE_TAGS.find((t) => tagKey(t.id) === k || tagKey(t.label) === k)?.id ?? null;
}

/**
 * Validate a submitted list. Duplicates (case-insensitive) collapse to the
 * first spelling; more than CUSTOM_TAG_MAX or any invalid entry is an error,
 * so a bad tag is never silently dropped or rewritten.
 */
export function parseCustomTags(raws: readonly string[]): { tags: string[]; error: string | null } {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    if (!raw.trim()) continue;
    const r = normalizeCustomTag(raw);
    if (!r.ok) return { tags: [], error: r.error };
    const k = tagKey(r.value);
    if (seen.has(k)) continue;
    seen.add(k);
    tags.push(r.value);
  }
  if (tags.length > CUSTOM_TAG_MAX) return { tags: [], error: `Up to ${CUSTOM_TAG_MAX} of your own tags.` };
  return { tags, error: null };
}

// ── Legacy bridge ────────────────────────────────────────────────────────────
// Events created before this taxonomy carry event_type / community / genre.
// These maps derive the new fields from them (reads fall back to this when an
// event has no `category`, and the one-shot migration writes it). They are
// conservative: only clean correspondences map; anything else is left out
// rather than guessed.

export const LEGACY_TYPE_TO_CATEGORY: Record<string, Category> = {
  music: "live_music",
  film: "film",
  comedy: "comedy",
  cultural: "culture",
  nightlife: "nightlife",
  food: "food",
  faith: "faith",
  conference: "business",
};

/** New events still write the legacy `event_type` for one release; this is the reverse map. */
export const CATEGORY_TO_LEGACY_TYPE: Record<Category, string | null> = {
  nightlife: "nightlife",
  live_music: "music",
  film: "film",
  comedy: "comedy",
  culture: "cultural",
  business: "conference",
  faith: "faith",
  food: "food",
  festival: "music",
  other: null,
};

const LEGACY_GENRE_TO_TAG: Record<string, SceneTag> = {
  afrobeats: "afrobeats",
  amapiano: "amapiano",
  highlife: "highlife",
  hip_hop: "hip_hop",
  nollywood: "nollywood",
};
const LEGACY_COMMUNITY_TO_TAG: Record<string, SceneTag> = {
  nigerian: "nigerian",
  ghanaian: "ghanaian",
  pan_african: "pan_african",
  caribbean: "caribbean",
};
/** Legacy `community` for a new event, from its tags — only where the meaning is identical. */
const TAG_TO_LEGACY_COMMUNITY: Partial<Record<SceneTag, string>> = {
  nigerian: "nigerian",
  ghanaian: "ghanaian",
  pan_african: "pan_african",
  caribbean: "caribbean",
  jamaican: "caribbean",
  trinidadian: "caribbean",
  ethiopian: "east_african",
  kenyan: "east_african",
};

export function deriveCategory(legacy: { event_type?: string | null }): Category {
  return (legacy.event_type && LEGACY_TYPE_TO_CATEGORY[legacy.event_type]) || "other";
}

export function deriveSceneTags(legacy: { genre?: string | null; community?: string | null }): SceneTag[] {
  const tags: SceneTag[] = [];
  const g = legacy.genre ? LEGACY_GENRE_TO_TAG[legacy.genre] : undefined;
  const c = legacy.community ? LEGACY_COMMUNITY_TO_TAG[legacy.community] : undefined;
  if (g) tags.push(g);
  if (c && !tags.includes(c)) tags.push(c);
  return tags;
}

/** Legacy fields to keep writing alongside the new ones, for anything that still reads them. */
export function legacyFieldsFor(category: Category, tags: readonly SceneTag[]): { event_type: string | null; community: string | null } {
  const community = tags.map((t) => TAG_TO_LEGACY_COMMUNITY[t]).find(Boolean) ?? null;
  return { event_type: CATEGORY_TO_LEGACY_TYPE[category], community };
}
