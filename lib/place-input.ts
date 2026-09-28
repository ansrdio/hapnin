// Admin form → Place fields. Pure (no Firestore), so it is unit-tested
// directly. Unknown or malformed input is a field error, never silently kept.

import { cleanText, normalizeInstagram, normalizeUsPhone, normalizeZip, type FieldErrors } from "./validation.ts";
import { isPlaceCategory, normalizeSceneTags, parseCustomTags, type PlaceCategory, type SceneTag } from "./taxonomy.ts";
import { LANGUAGE_CODE, isOneOf, type LanguageCode } from "./enums.ts";

export type PlaceOffering = { name: string; details: string | null };

export type PlaceValues = {
  name: string;
  slug: string;
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
  website: string | null;
  instagram: string | null;
  phone: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  gallery: string[];
  owner_display: string | null;
  claimed: boolean;
  featured: boolean;
};

export const MAX_GALLERY = 12;
export const MAX_OFFERINGS = 12;

export function slugifyName(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return /^[a-z0-9][a-z0-9-]{1,59}$/.test(s) ? s : null;
}

/** https URL (scheme added if missing); null when blank; undefined when invalid. */
export function normalizeWebUrl(raw: string): string | null | undefined {
  const s = (raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return undefined;
    return u.toString().slice(0, 300);
  } catch {
    return undefined;
  }
}

export function httpsImageUrl(raw: string): string | null | undefined {
  const s = (raw || "").trim();
  if (!s) return null;
  return /^https:\/\/\S{1,700}$/.test(s) ? s : undefined;
}

/** "Suya platter — grilled on the spot" or "Suya platter: grilled…" → { name, details }. */
export function parseOfferings(raw: string): { offerings: PlaceOffering[]; error: string | null } {
  const lines = (raw || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_OFFERINGS) return { offerings: [], error: `Up to ${MAX_OFFERINGS} lines.` };
  const offerings = lines.map((l) => {
    const m = l.match(/^(.{1,80}?)\s*(?:—|–|-|:)\s+(.+)$/);
    return m ? { name: cleanText(m[1], 80), details: cleanText(m[2], 200) || null } : { name: cleanText(l, 80), details: null };
  });
  return { offerings: offerings.filter((o) => o.name), error: null };
}

export function parsePlaceForm(formData: FormData): { values: Partial<PlaceValues>; fieldErrors: FieldErrors } {
  const s = (k: string) => String(formData.get(k) ?? "");
  const name = cleanText(s("name"), 120);
  const slug = slugifyName(s("slug") || name);
  const categoryRaw = s("category");
  const website = normalizeWebUrl(s("website"));
  const instagramRaw = s("instagram");
  const instagram = instagramRaw.trim() ? normalizeInstagram(instagramRaw) : null;
  const phoneRaw = s("phone").trim();
  const phone = phoneRaw ? normalizeUsPhone(phoneRaw) : null;
  const zipRaw = s("zip").trim();
  const zip = zipRaw ? normalizeZip(zipRaw) : null;
  const hero = httpsImageUrl(s("hero_image_url"));
  const galleryRaw = formData.getAll("gallery").map(String).map((g) => g.trim()).filter(Boolean);
  const gallery = galleryRaw.map((g) => httpsImageUrl(g)).filter((g): g is string => typeof g === "string");
  const offerings = parseOfferings(s("offerings"));
  const custom = parseCustomTags(formData.getAll("custom_tags").map(String));
  const languages = [...new Set(formData.getAll("languages").map(String))].filter((l): l is LanguageCode => isOneOf(LANGUAGE_CODE, l)).slice(0, 4);

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Required.";
  if (!slug) fieldErrors.slug = "Letters, numbers and hyphens (2–60).";
  if (!isPlaceCategory(categoryRaw)) fieldErrors.category = "Pick a category.";
  const city = cleanText(s("city"), 80);
  const state = cleanText(s("state"), 40);
  if (!city) fieldErrors.city = "Required.";
  if (!state) fieldErrors.state = "Required.";
  if (website === undefined) fieldErrors.website = "A full web address, e.g. https://example.com.";
  if (instagram === null && instagramRaw.trim()) fieldErrors.instagram = "Handle only, e.g. agege.phx.";
  if (phoneRaw && !phone) fieldErrors.phone = "US number, e.g. (602) 555-0142.";
  if (zipRaw && !zip) fieldErrors.zip = "5-digit ZIP.";
  if (hero === undefined) fieldErrors.hero_image_url = "Upload an image or paste an https:// link.";
  if (galleryRaw.length !== gallery.length) fieldErrors.gallery = "Every gallery image must be an https:// link.";
  if (gallery.length > MAX_GALLERY) fieldErrors.gallery = `Up to ${MAX_GALLERY} images.`;
  if (offerings.error) fieldErrors.offerings = offerings.error;
  if (custom.error) fieldErrors.custom_tags = custom.error;

  return {
    values: {
      name,
      slug: slug ?? undefined,
      category: isPlaceCategory(categoryRaw) ? categoryRaw : undefined,
      short_description: cleanText(s("short_description"), 200) || null,
      about: cleanText(s("about"), 5000) || null,
      culture_note: cleanText(s("culture_note"), 1500) || null,
      offerings: offerings.offerings,
      scene_tags: normalizeSceneTags(formData.getAll("scene_tags").map(String)),
      custom_tags: custom.tags,
      languages,
      address: cleanText(s("address"), 240) || null,
      city,
      state,
      zip: zip ?? null,
      website: website ?? null,
      instagram: instagram ?? null,
      phone: phone ?? null,
      hero_image_url: hero ?? null,
      hero_image_alt: cleanText(s("hero_image_alt"), 200) || null,
      gallery: gallery.slice(0, MAX_GALLERY),
      owner_display: cleanText(s("owner_display"), 120) || null,
      claimed: formData.get("claimed") === "on",
      featured: formData.get("featured") === "on",
    },
    fieldErrors,
  };
}
