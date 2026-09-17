// The exact Firestore payload written when an organizer edits an event's
// details. Pure (no Firestore) so it can be unit-tested; lib/events.ts
// applies it with `update()`.
//
// Every key is always present. Optional fields (primary_language, genre) are
// written as explicit null when cleared — omitting them would leave the old
// stored value in place, which is precisely the bug this guards against.

import type { LanguageCode, Genre } from "./enums";
import { legacyFieldsFor, type Category, type SceneTag } from "./taxonomy.ts";
import type { RefundPolicy } from "./refund-policy";

export type EventDetailsUpdate = {
  title: string;
  description: string | null;
  venue_name: string;
  venue_address: string;
  venue_zip: string | null;
  city: string;
  state: string;
  starts_at: number;
  capacity: number | null;
  refund_policy: RefundPolicy;
  referral_off_cents: number; // bring-a-friend: flat discount for a referred friend; 0 = off
  category: Category;
  scene_tags: SceneTag[];
  primary_language: LanguageCode | null;
  genre: Genre | null;
  talent: string[];
};

export function buildEventDetailsUpdate(d: EventDetailsUpdate): Record<string, unknown> {
  return {
    ...d,
    primary_language: d.primary_language ?? null,
    genre: d.genre ?? null,
    // Legacy fields still written for one release (see lib/taxonomy.ts). Never
    // touches genre or language, so a cleared genre can't come back as "other".
    ...legacyFieldsFor(d.category, d.scene_tags),
    // The address may have changed: drop the stored pin so the next page view re-geocodes.
    venue_lat: null,
    venue_lng: null,
    venue_geocoded_at: null,
  };
}
