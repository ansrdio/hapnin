import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";
import { normalizeSceneTags, CUSTOM_TAG_MAX, type SceneTag } from "./taxonomy";
import type { StoryValues } from "./story-input";

// Inside the Culture — editorial/video stories (Experiment 001). Admin-created.
// A story lists the places it's about (place_ids) and any events it references
// (event_ids); those are the relationships — nothing is copied.

const COLL = "stories";
const SLUGS = "story_slugs";

export type StoryStatus = "draft" | "published";

export type StoryRecord = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  video_url: string | null;
  body: string | null;
  place_ids: string[];
  event_ids: string[];
  scene_tags: SceneTag[];
  custom_tags: string[];
  author: string | null;
  status: StoryStatus;
  featured: boolean;
  published_at: number | null;
  created_at: number | null;
  updated_at: number | null;
};

const ms = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : typeof v === "number" ? v : null;
};
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function toStory(id: string, d: FirebaseFirestore.DocumentData): StoryRecord {
  return {
    id,
    slug: d.slug,
    title: d.title,
    subtitle: strOrNull(d.subtitle),
    hero_image_url: strOrNull(d.hero_image_url),
    hero_image_alt: strOrNull(d.hero_image_alt),
    video_url: strOrNull(d.video_url),
    body: strOrNull(d.body),
    place_ids: ids(d.place_ids),
    event_ids: ids(d.event_ids),
    scene_tags: normalizeSceneTags(d.scene_tags),
    custom_tags: ids(d.custom_tags).slice(0, CUSTOM_TAG_MAX),
    author: strOrNull(d.author),
    status: d.status === "published" ? "published" : "draft",
    featured: d.featured === true,
    published_at: ms(d.published_at),
    created_at: ms(d.created_at),
    updated_at: ms(d.updated_at),
  };
}

type StoryWrite = Omit<StoryValues, "event_refs"> & { event_ids: string[] };

function fieldsFrom(v: StoryWrite) {
  return {
    title: v.title,
    subtitle: v.subtitle,
    hero_image_url: v.hero_image_url,
    hero_image_alt: v.hero_image_alt,
    video_url: v.video_url,
    body: v.body,
    place_ids: v.place_ids,
    event_ids: v.event_ids,
    scene_tags: v.scene_tags,
    custom_tags: v.custom_tags,
    author: v.author,
    featured: v.featured,
  };
}

export async function createStory(v: StoryWrite): Promise<StoryRecord> {
  const db = getDb();
  const ref = db.collection(COLL).doc();
  try {
    await db.collection(SLUGS).doc(v.slug).create({ story_id: ref.id });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) throw new Error("SLUG_TAKEN");
    throw err;
  }
  await ref.set({ ...fieldsFrom(v), slug: v.slug, status: "draft", published_at: null, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
  return (await getStoryById(ref.id))!;
}

export async function updateStory(id: string, v: StoryWrite): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLL).doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("NOT_FOUND");
    const old = snap.data()!;
    if (old.slug !== v.slug) {
      const newSlug = db.collection(SLUGS).doc(v.slug);
      if ((await tx.get(newSlug)).exists) throw new Error("SLUG_TAKEN");
      tx.set(newSlug, { story_id: id });
      tx.delete(db.collection(SLUGS).doc(old.slug));
    }
    tx.update(ref, { ...fieldsFrom(v), slug: v.slug, updated_at: FieldValue.serverTimestamp() });
  });
}

/** Publishing stamps published_at the first time only (re-publishing keeps the original date). */
export async function setStoryStatus(id: string, status: StoryStatus): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLL).doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("NOT_FOUND");
    tx.update(ref, {
      status,
      ...(status === "published" && !snap.data()!.published_at ? { published_at: Date.now() } : {}),
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

export async function getStoryById(id: string): Promise<StoryRecord | null> {
  if (!id) return null;
  const snap = await getDb().collection(COLL).doc(id).get();
  return snap.exists ? toStory(snap.id, snap.data()!) : null;
}

export async function getStoryBySlug(slug: string): Promise<StoryRecord | null> {
  if (!slug.trim() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const lookup = await getDb().collection(SLUGS).doc(slug).get();
  if (!lookup.exists) return null;
  return getStoryById(lookup.data()!.story_id);
}

const newestFirst = (a: StoryRecord, b: StoryRecord) => Number(b.featured) - Number(a.featured) || (b.published_at ?? 0) - (a.published_at ?? 0);

export async function listPublishedStories(limit = 60): Promise<StoryRecord[]> {
  const snap = await getDb().collection(COLL).where("status", "==", "published").limit(500).get();
  return snap.docs.map((d) => toStory(d.id, d.data())).sort(newestFirst).slice(0, limit);
}

export async function listAllStories(): Promise<StoryRecord[]> {
  const snap = await getDb().collection(COLL).limit(500).get();
  return snap.docs.map((d) => toStory(d.id, d.data())).sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
}

/** Published stories about a place (for its page). */
export async function listPublishedStoriesForPlace(placeId: string): Promise<StoryRecord[]> {
  const snap = await getDb().collection(COLL).where("place_ids", "array-contains", placeId).get();
  return snap.docs.map((d) => toStory(d.id, d.data())).filter((s) => s.status === "published").sort(newestFirst);
}

/** Published stories that reference an event (for the event page). */
export async function listPublishedStoriesForEvent(eventId: string): Promise<StoryRecord[]> {
  const snap = await getDb().collection(COLL).where("event_ids", "array-contains", eventId).get();
  return snap.docs.map((d) => toStory(d.id, d.data())).filter((s) => s.status === "published").sort(newestFirst);
}

/** Admin: every story (any status) linked to a place. */
export async function listStoriesForPlace(placeId: string): Promise<StoryRecord[]> {
  const snap = await getDb().collection(COLL).where("place_ids", "array-contains", placeId).get();
  return snap.docs.map((d) => toStory(d.id, d.data())).sort(newestFirst);
}
