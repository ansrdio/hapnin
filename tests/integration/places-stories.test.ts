// Experiment 001 against the emulator: publication visibility, Place ↔ Story,
// Place ↔ Event, missing relationships, invalid slugs, series cloning, the
// sitemap, and that old events are untouched.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedEvent, installFakeStripe } from "./helpers";
import { getDb } from "../../lib/firebase-admin";
import { createPlace, updatePlace, setPlaceStatus, getPlaceBySlug, listPublishedPlaces, getPlaceById } from "../../lib/places";
import { createStory, setStoryStatus, getStoryBySlug, listPublishedStories, listPublishedStoriesForPlace, listPublishedStoriesForEvent, getStoryById } from "../../lib/stories";
import { setEventPlace, listUpcomingEventsForPlace, getEventById, createEvent } from "../../lib/events";
import { createSeries } from "../../lib/series";
import type { PlaceValues } from "../../lib/place-input";
import sitemap from "../../app/sitemap";

beforeEach(async () => {
  await resetDb();
  installFakeStripe();
});

const placeValues = (over: Partial<PlaceValues> = {}): PlaceValues => ({
  name: "QA Kitchen", slug: `qa-kitchen-${Math.random().toString(36).slice(2, 7)}`, category: "restaurant",
  short_description: null, about: null, culture_note: null, offerings: [], scene_tags: ["nigerian", "ghanaian"], custom_tags: [],
  languages: [], address: null, city: "Phoenix", state: "AZ", zip: null, website: null, instagram: null, phone: null,
  hero_image_url: null, hero_image_alt: null, gallery: [], owner_display: null, claimed: false, featured: false, ...over,
});
const storyValues = (over: Record<string, unknown> = {}) => ({
  title: "QA Story", slug: `qa-story-${Math.random().toString(36).slice(2, 7)}`, subtitle: null, hero_image_url: null, hero_image_alt: null,
  video_url: null, body: null, place_ids: [] as string[], event_ids: [] as string[], scene_tags: [], custom_tags: [], author: null, featured: false, ...over,
});

test("a new place is a draft: resolvable by slug for admin preview, absent from public listings until published", async () => {
  const p = await createPlace(placeValues());
  assert.equal(p.status, "draft");
  assert.equal((await getPlaceBySlug(p.slug))?.id, p.id);
  assert.equal((await listPublishedPlaces()).length, 0);
  await setPlaceStatus(p.id, "published");
  assert.deepEqual((await listPublishedPlaces()).map((x) => x.id), [p.id]);
  assert.deepEqual((await getPlaceById(p.id))?.scene_tags, ["nigerian", "ghanaian"], "several cultures on one place");
});

test("invalid and unknown slugs resolve to nothing (the page 404s)", async () => {
  for (const s of ["", "no-such-place", "../etc", "UPPER", "a".repeat(200)]) {
    assert.equal(await getPlaceBySlug(s), null, s);
    assert.equal(await getStoryBySlug(s), null, s);
  }
});

test("slugs are unique; renaming a slug moves the reservation", async () => {
  const a = await createPlace(placeValues({ slug: "same-slug" }));
  await assert.rejects(createPlace(placeValues({ slug: "same-slug" })), /SLUG_TAKEN/);
  await updatePlace(a.id, placeValues({ slug: "new-slug" }));
  assert.equal(await getPlaceBySlug("same-slug"), null);
  assert.equal((await getPlaceBySlug("new-slug"))?.id, a.id);
  await createPlace(placeValues({ slug: "same-slug" })); // freed
});

test("Place ↔ Story: only published stories show on a place; published_at is stamped once", async () => {
  const p = await createPlace(placeValues());
  const s = await createStory(storyValues({ place_ids: [p.id] }));
  assert.equal((await listPublishedStoriesForPlace(p.id)).length, 0, "draft story hidden");
  await setStoryStatus(s.id, "published");
  const first = (await getStoryById(s.id))!.published_at;
  assert.ok(first);
  assert.deepEqual((await listPublishedStoriesForPlace(p.id)).map((x) => x.id), [s.id]);
  await setStoryStatus(s.id, "draft");
  assert.equal((await listPublishedStories()).length, 0);
  await setStoryStatus(s.id, "published");
  assert.equal((await getStoryById(s.id))!.published_at, first, "re-publishing keeps the original date");
});

test("Place ↔ Event: only on-sale, upcoming, non-sample linked events show; unlinking removes it", async () => {
  const p = await createPlace(placeValues());
  const live = await seedEvent();
  const sample = await seedEvent({ is_sample: true });
  const draft = await seedEvent();
  await getDb().collection("events").doc(draft.event.id).update({ status: "draft" });
  const past = await seedEvent();
  await getDb().collection("events").doc(past.event.id).update({ starts_at: Date.now() - 3 * 86_400_000 });
  for (const e of [live, sample, draft, past]) await setEventPlace(e.event.id, p.id);

  assert.deepEqual((await listUpcomingEventsForPlace(p.id)).map((e) => e.id), [live.event.id]);
  assert.equal((await getEventById(live.event.id))?.place_id, p.id);
  await setEventPlace(live.event.id, null);
  assert.equal((await listUpcomingEventsForPlace(p.id)).length, 0);
  assert.equal((await getEventById(live.event.id))?.place_id, null);
});

test("Story ↔ Event: an event shows only published stories that reference it", async () => {
  const e = await seedEvent();
  const s = await createStory(storyValues({ event_ids: [e.event.id] }));
  assert.equal((await listPublishedStoriesForEvent(e.event.id)).length, 0);
  await setStoryStatus(s.id, "published");
  assert.deepEqual((await listPublishedStoriesForEvent(e.event.id)).map((x) => x.id), [s.id]);
});

test("missing relationships never break reads: a story pointing at a deleted place or event still loads", async () => {
  const s = await createStory(storyValues({ place_ids: ["gone-place"], event_ids: ["gone-event"] }));
  const story = await getStoryById(s.id);
  assert.deepEqual(story?.place_ids, ["gone-place"]);
  assert.equal(await getEventById("gone-event"), null);
  assert.equal((await listUpcomingEventsForPlace("gone-place")).length, 0);
});

test("old events without a place are unchanged: place_id reads as null, creation without it still works", async () => {
  const { event } = await seedEvent();
  assert.equal(event.place_id, null);
  // A legacy doc written before Places existed has no place_id field at all.
  await getDb().collection("events").doc(event.id).update({ place_id: (await import("firebase-admin/firestore")).FieldValue.delete() });
  assert.equal((await getEventById(event.id))?.place_id, null);
});

test("a series cloned from an event keeps its Place link; one without a place stays without", async () => {
  const p = await createPlace(placeValues());
  const linked = await seedEvent();
  await setEventPlace(linked.event.id, p.id);
  const src = (await getEventById(linked.event.id))!;
  const ids = await createSeries({ source: src, organizerId: src.organizer_id, cadence: "weekly" as never, count: 2, publish: false });
  for (const id of ids) assert.equal((await getEventById(id))?.place_id, p.id);

  const plain = await seedEvent();
  const ids2 = await createSeries({ source: plain.event, organizerId: plain.event.organizer_id, cadence: "weekly" as never, count: 1, publish: false });
  assert.equal((await getEventById(ids2[0]))?.place_id, null);
});

test("createEvent accepts an explicit place link", async () => {
  const p = await createPlace(placeValues());
  const s = await seedEvent();
  const e = await createEvent({
    organizer_id: s.organizer.id, title: "Linked", slug: `linked-${Date.now()}`, venue_name: "V", venue_address: "1 St", city: "Phoenix", state: "AZ",
    starts_at: Date.now() + 86_400_000, category: "food", place_id: p.id, tiers: [{ name: "GA", price_cents: 0, quantity_total: 5, sales_start_at: null, sales_end_at: null }],
  });
  assert.equal(e.place_id, p.id);
});

test("sitemap lists published places and stories, never drafts", async () => {
  const pub = await createPlace(placeValues({ slug: "published-place" }));
  await setPlaceStatus(pub.id, "published");
  await createPlace(placeValues({ slug: "draft-place" }));
  const st = await createStory(storyValues({ slug: "published-story" }));
  await setStoryStatus(st.id, "published");
  await createStory(storyValues({ slug: "draft-story" }));
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes("https://www.hapnin.now/places/published-place"));
  assert.ok(urls.includes("https://www.hapnin.now/stories/published-story"));
  assert.ok(urls.includes("https://www.hapnin.now/places"));
  assert.ok(!urls.some((u) => u.includes("draft-place") || u.includes("draft-story")));
});
