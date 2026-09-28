import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";
import { geocodeAddress } from "./geocode";
import { isPlaceCategory, normalizeSceneTags, CUSTOM_TAG_MAX, type PlaceCategory, type SceneTag } from "./taxonomy";
import { LANGUAGE_CODE, isOneOf, type LanguageCode } from "./enums";
import type { PlaceOffering, PlaceValues } from "./place-input";

// Places — culturally relevant businesses, organizations and spaces
// (Experiment 001). Created and edited from /admin only. One Firestore doc per
// place; slugs reserved in place_slugs (same pattern as events). Events link
// to a place with an optional events.place_id; stories list place_ids. No
// business details are copied onto events or stories.

const COLL = "places";
const SLUGS = "place_slugs";

export type PlaceStatus = "draft" | "published";

export type PlaceRecord = {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  short_description: string | null;
  about: string | null;
  culture_note: string | null;
  offerings: PlaceOffering[];
  scene_tags: SceneTag[];
  custom_tags: string[];
  languages: LanguageCode[];
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  geocoded_at: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  gallery: string[];
  owner_display: string | null;
  claimed: boolean;
  status: PlaceStatus;
  featured: boolean;
  created_at: number | null;
  updated_at: number | null;
};

const ms = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | null;
  return t?.toMillis ? t.toMillis() : typeof v === "number" ? v : null;
};
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function toPlace(id: string, d: FirebaseFirestore.DocumentData): PlaceRecord {
  return {
    id,
    slug: d.slug,
    name: d.name,
    category: isPlaceCategory(d.category) ? d.category : "other",
    short_description: strOrNull(d.short_description),
    about: strOrNull(d.about),
    culture_note: strOrNull(d.culture_note),
    offerings: Array.isArray(d.offerings)
      ? d.offerings.filter((o: unknown) => o && typeof (o as PlaceOffering).name === "string").map((o: PlaceOffering) => ({ name: o.name, details: strOrNull(o.details) }))
      : [],
    scene_tags: normalizeSceneTags(d.scene_tags),
    custom_tags: Array.isArray(d.custom_tags) ? d.custom_tags.filter((t: unknown): t is string => typeof t === "string").slice(0, CUSTOM_TAG_MAX) : [],
    languages: Array.isArray(d.languages) ? d.languages.filter((l: unknown): l is LanguageCode => isOneOf(LANGUAGE_CODE, l)) : [],
    address: strOrNull(d.address),
    city: d.city ?? "",
    state: d.state ?? "",
    zip: strOrNull(d.zip),
    lat: typeof d.lat === "number" ? d.lat : null,
    lng: typeof d.lng === "number" ? d.lng : null,
    geocoded_at: typeof d.geocoded_at === "number" ? d.geocoded_at : null,
    website: strOrNull(d.website),
    instagram: strOrNull(d.instagram),
    phone: strOrNull(d.phone),
    hero_image_url: strOrNull(d.hero_image_url),
    hero_image_alt: strOrNull(d.hero_image_alt),
    gallery: Array.isArray(d.gallery) ? d.gallery.filter((g: unknown): g is string => typeof g === "string") : [],
    owner_display: strOrNull(d.owner_display),
    claimed: d.claimed === true,
    status: d.status === "published" ? "published" : "draft",
    featured: d.featured === true,
    created_at: ms(d.created_at),
    updated_at: ms(d.updated_at),
  };
}

function fieldsFrom(v: PlaceValues) {
  return {
    name: v.name,
    category: v.category,
    short_description: v.short_description,
    about: v.about,
    culture_note: v.culture_note,
    offerings: v.offerings,
    scene_tags: v.scene_tags,
    custom_tags: v.custom_tags,
    languages: v.languages,
    address: v.address,
    city: v.city,
    state: v.state,
    zip: v.zip,
    website: v.website,
    instagram: v.instagram,
    phone: v.phone,
    hero_image_url: v.hero_image_url,
    hero_image_alt: v.hero_image_alt,
    gallery: v.gallery,
    owner_display: v.owner_display,
    claimed: v.claimed,
    featured: v.featured,
  };
}

/** Create a DRAFT place, reserving its slug. Throws "SLUG_TAKEN". */
export async function createPlace(v: PlaceValues): Promise<PlaceRecord> {
  const db = getDb();
  const ref = db.collection(COLL).doc();
  try {
    await db.collection(SLUGS).doc(v.slug).create({ place_id: ref.id });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) throw new Error("SLUG_TAKEN");
    throw err;
  }
  await ref.set({ ...fieldsFrom(v), slug: v.slug, status: "draft", lat: null, lng: null, geocoded_at: null, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
  return (await getPlaceById(ref.id))!;
}

/** Update every editable field; a slug change moves the reservation atomically. Throws "SLUG_TAKEN". */
export async function updatePlace(id: string, v: PlaceValues): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLL).doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("NOT_FOUND");
    const old = snap.data()!;
    const addressChanged = old.address !== v.address || old.city !== v.city || old.state !== v.state || old.zip !== v.zip;
    if (old.slug !== v.slug) {
      const newSlug = db.collection(SLUGS).doc(v.slug);
      const taken = await tx.get(newSlug);
      if (taken.exists) throw new Error("SLUG_TAKEN");
      tx.set(newSlug, { place_id: id });
      tx.delete(db.collection(SLUGS).doc(old.slug));
    }
    tx.update(ref, {
      ...fieldsFrom(v),
      slug: v.slug,
      ...(addressChanged ? { lat: null, lng: null, geocoded_at: null } : {}),
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

export async function setPlaceStatus(id: string, status: PlaceStatus): Promise<void> {
  await getDb().collection(COLL).doc(id).update({ status, updated_at: FieldValue.serverTimestamp() });
}

export async function getPlaceById(id: string): Promise<PlaceRecord | null> {
  if (!id) return null;
  const snap = await getDb().collection(COLL).doc(id).get();
  return snap.exists ? toPlace(snap.id, snap.data()!) : null;
}

export async function getPlaceBySlug(slug: string): Promise<PlaceRecord | null> {
  if (!slug.trim() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const lookup = await getDb().collection(SLUGS).doc(slug).get();
  if (!lookup.exists) return null;
  return getPlaceById(lookup.data()!.place_id);
}

export async function getPlacesByIds(ids: string[]): Promise<PlaceRecord[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const snaps = await db.getAll(...ids.map((i) => db.collection(COLL).doc(i)));
  return snaps.filter((s) => s.exists).map((s) => toPlace(s.id, s.data()!));
}

const byFeaturedThenName = (a: PlaceRecord, b: PlaceRecord) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name);

/** Public listing: published only, featured first. */
export async function listPublishedPlaces(limit = 100): Promise<PlaceRecord[]> {
  const snap = await getDb().collection(COLL).where("status", "==", "published").limit(500).get();
  return snap.docs.map((d) => toPlace(d.id, d.data())).sort(byFeaturedThenName).slice(0, limit);
}

/** Admin listing: everything. */
export async function listAllPlaces(): Promise<PlaceRecord[]> {
  const snap = await getDb().collection(COLL).limit(500).get();
  return snap.docs.map((d) => toPlace(d.id, d.data())).sort(byFeaturedThenName);
}

/** Map pin: geocode once and store; a miss isn't retried for a day. */
export async function ensurePlaceGeocoded(p: PlaceRecord): Promise<{ lat: number; lng: number } | null> {
  if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
  if (!p.address) return null;
  if (p.geocoded_at && Date.now() - p.geocoded_at < 86_400_000) return null;
  const hit = await geocodeAddress([p.address, p.city, p.state, p.zip]).catch(() => null);
  await getDb().collection(COLL).doc(p.id).update({ lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocoded_at: Date.now() }).catch(() => {});
  return hit;
}
