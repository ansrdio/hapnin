import "server-only";
import { EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE, isOneOf } from "./enums";
import { cleanText, type FieldErrors } from "./validation";
import type { NewTier } from "./events";

// Shared event-form parsing + validation, used by both the admin create form and
// the organizer's event builder so the rules never drift between them.

// America/Phoenix is UTC-7 year-round (no DST). Fine for the launch city;
// generalize with a tz library when events span timezones.
export function parsePhoenixLocal(dt: string): number | null {
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 7, +m[5]);
}

export function slugify(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z0-9][a-z0-9-]{1,60}$/.test(s) ? s : null;
}

export type ParsedEventValues = {
  title: string;
  slug: string;
  description: string | null;
  venue_name: string;
  venue_address: string;
  city: string;
  state: string;
  starts_at: number;
  capacity: number | null;
  talent: string[];
  is_first_event: boolean;
  event_type: string;
  community: string;
  primary_language: string;
  genre: string;
  tiers: NewTier[];
};

/** Parse + validate the event form. Returns partial values plus any field errors. */
export function parseEventForm(formData: FormData): {
  values: Partial<ParsedEventValues>;
  fieldErrors: FieldErrors;
} {
  const title = cleanText(String(formData.get("title") ?? ""), 160);
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  const venue_name = cleanText(String(formData.get("venue_name") ?? ""), 160);
  const venue_address = cleanText(String(formData.get("venue_address") ?? ""), 240);
  const city = cleanText(String(formData.get("city") ?? ""), 80);
  const state = cleanText(String(formData.get("state") ?? ""), 40);
  const starts_at = parsePhoenixLocal(String(formData.get("starts_at") ?? ""));
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null;
  const description = cleanText(String(formData.get("description") ?? ""), 2000) || null;
  const talent = String(formData.get("talent") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const is_first_event = formData.get("is_first_event") === "on";

  const event_type = String(formData.get("event_type") ?? "");
  const community = String(formData.get("community") ?? "");
  const primary_language = String(formData.get("primary_language") ?? "");
  const genre = String(formData.get("genre") ?? "");

  const names = formData.getAll("tier_name").map(String);
  const prices = formData.getAll("tier_price").map(String);
  const qtys = formData.getAll("tier_qty").map(String);
  const tiers = names
    .map((name, i) => ({
      name: cleanText(name, 80),
      price_cents: Math.round(parseFloat(prices[i] || "0") * 100),
      quantity_total: parseInt(qtys[i] || "0", 10),
    }))
    .filter((t) => t.name && t.quantity_total > 0 && t.price_cents >= 0);

  const fieldErrors: FieldErrors = {};
  if (!title) fieldErrors.title = "Required.";
  if (!slug) fieldErrors.slug = "Letters, numbers, hyphens.";
  if (!venue_name) fieldErrors.venue_name = "Required.";
  if (!venue_address) fieldErrors.venue_address = "Required.";
  if (!city) fieldErrors.city = "Required.";
  if (!state) fieldErrors.state = "Required.";
  if (!starts_at) fieldErrors.starts_at = "Pick a date and time.";
  if (!isOneOf(EVENT_TYPE, event_type)) fieldErrors.event_type = "Pick one.";
  if (!isOneOf(COMMUNITY, community)) fieldErrors.community = "Pick one.";
  if (!isOneOf(LANGUAGE_CODE, primary_language)) fieldErrors.primary_language = "Pick one.";
  if (!isOneOf(GENRE, genre)) fieldErrors.genre = "Pick one.";
  if (tiers.length === 0) fieldErrors.tiers = "Add at least one tier with a name and quantity.";

  return {
    values: {
      title, slug: slug ?? undefined, description,
      venue_name, venue_address, city, state,
      starts_at: starts_at ?? undefined, capacity, talent, is_first_event,
      event_type, community, primary_language, genre, tiers,
    },
    fieldErrors,
  };
}
