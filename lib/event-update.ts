// The exact Firestore payload written when an organizer edits an event's
// details. Pure (no Firestore) so it can be unit-tested; lib/events.ts
// applies it with `update()`.
//
// Every key listed here is always present. `primary_language` is written as
// explicit null when cleared — omitting it would leave the old value in place.
// `genre` is deliberately NOT a key: it is a retained legacy field, no longer
// organizer-facing, and an edit must leave whatever is stored untouched.

import type { LanguageCode } from "./enums";
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
  custom_tags: string[];
  primary_language: LanguageCode | null;
  talent: string[];
};

export function buildEventDetailsUpdate(d: EventDetailsUpdate): Record<string, unknown> {
  return {
    ...d,
    primary_language: d.primary_language ?? null,
    // Legacy fields still written for one release (see lib/taxonomy.ts). Never
    // touches genre or language.
    ...legacyFieldsFor(d.category, d.scene_tags),
    // The address may have changed: drop the stored pin so the next page view re-geocodes.
    venue_lat: null,
    venue_lng: null,
    venue_geocoded_at: null,
  };
}
