// The Experiment 001 chain end to end at the data layer:
// Instagram → Story → Place → Event → Checkout → successful order,
// then the admin funnel reading it back. Uses the real checkout code
// (free, demo and paid paths) with a fake Stripe.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedEvent, installFakeStripe, data } from "./helpers";
import { getDb } from "../../lib/firebase-admin";
import { setStripeForTests } from "../../lib/stripe";
import { createPlace, setPlaceStatus } from "../../lib/places";
import { createStory, setStoryStatus } from "../../lib/stories";
import { setEventPlace } from "../../lib/events";
import { createCheckoutIntent, fulfillPaidOrder } from "../../lib/checkout";
import { recordDiscoveryEvent, getStoryFunnel, getPlaceFunnel } from "../../lib/discovery";
import { sanitizeAttribution, referralSourceFrom, type Attribution } from "../../lib/attribution";
import type { PlaceValues } from "../../lib/place-input";

beforeEach(async () => {
  await resetDb();
  installFakeStripe();
});

const placeValues: PlaceValues = {
  name: "QA Kitchen", slug: "qa-kitchen", category: "restaurant", short_description: null, about: null, culture_note: null, offerings: [],
  scene_tags: ["nigerian"], custom_tags: [], languages: [], address: null, city: "Phoenix", state: "AZ", zip: null, website: null,
  instagram: null, phone: null, hero_image_url: null, hero_image_alt: null, gallery: [], owner_display: null, claimed: false, featured: false,
};

async function world(opts: { price_cents?: number; is_sample?: boolean } = {}) {
  const place = await createPlace(placeValues);
  await setPlaceStatus(place.id, "published");
  const s = await seedEvent({ tiers: [{ name: "GA", price_cents: opts.price_cents ?? 0, quantity_total: 20 }], is_sample: opts.is_sample });
  await setEventPlace(s.event.id, place.id);
  const story = await createStory({ title: "QA Story", slug: "qa-story", subtitle: null, hero_image_url: null, hero_image_alt: null, video_url: null, body: null, place_ids: [place.id], event_ids: [s.event.id], scene_tags: [], custom_tags: [], author: null, featured: false });
  await setStoryStatus(story.id, "published");
  return { place, story, ...s };
}

const buyer = { phone: "+16025550142", email: "buyer@example.com", first_name: "Ada", last_name: "Test", postal_code: null, screening_interest: null, marketing_opt_in: false, show_name: true };

/** What the browser sends after: Instagram link → story → place → clicked the event. */
function journey(storyId: string, placeId: string): Attribution {
  return sanitizeAttribution({
    visit_id: "v_qa_journey_1", first_source: "instagram", first_campaign: "agege-ig", landing_path: "/stories/qa-story?src=agege-ig",
    referrer_host: "l.instagram.com", story_id: storyId, place_id: placeId, ref_type: "place", ref_id: placeId,
  })!;
}

async function simulateBrowsing(a: Attribution, ids: { story: string; place: string; event: string }) {
  // The beacons the pages fire, in order, with the visit context each would carry at that moment.
  const at = (over: Partial<Attribution>) => ({ ...a, ...over });
  await recordDiscoveryEvent({ name: "story_viewed", attribution: at({ story_id: null, place_id: null, ref_type: null, ref_id: null }), story_id: ids.story, place_id: null, event_id: null, path: "/stories/qa-story" });
  await recordDiscoveryEvent({ name: "story_video_played", attribution: at({ place_id: null, ref_type: null, ref_id: null }), story_id: ids.story, place_id: null, event_id: null, path: "/stories/qa-story" });
  await recordDiscoveryEvent({ name: "story_to_place_clicked", attribution: at({ place_id: null, ref_type: null, ref_id: null }), story_id: ids.story, place_id: ids.place, event_id: null, path: "/stories/qa-story" });
  await recordDiscoveryEvent({ name: "place_viewed", attribution: at({ place_id: null, ref_type: "story", ref_id: ids.story }), story_id: null, place_id: ids.place, event_id: null, path: "/places/qa-kitchen" });
  await recordDiscoveryEvent({ name: "place_instagram_clicked", attribution: at({ ref_type: null, ref_id: null }), story_id: null, place_id: ids.place, event_id: null, path: "/places/qa-kitchen" });
  await recordDiscoveryEvent({ name: "place_to_event_clicked", attribution: at({ ref_type: null, ref_id: null }), story_id: null, place_id: ids.place, event_id: ids.event, path: "/places/qa-kitchen" });
  await recordDiscoveryEvent({ name: "event_viewed_from_place", attribution: at({}), story_id: null, place_id: ids.place, event_id: ids.event, path: "/e/x" });
  await recordDiscoveryEvent({ name: "checkout_viewed", attribution: at({}), story_id: null, place_id: null, event_id: ids.event, path: "/e/x/checkout" });
}

test("free RSVP: the order carries the full journey and the organizer's source is fixed", async () => {
  const w = await world({ price_cents: 0 });
  const a = journey(w.story.id, w.place.id);
  const r = await createCheckoutIntent({
    slug: w.event.slug, tierId: w.tierId, quantity: 2, buyer, referral_source: referralSourceFrom(a), promoter_code: null, promo_code: null, friend_code: null, friends: [], attribution: a, ip: null, user_agent: null,
  });
  assert.equal(r.kind, "free");
  const order = await data(`orders/${(r as { orderId: string }).orderId}`);
  assert.equal(order?.referral_source, "instagram", "was always null before the fix");
  assert.equal(order?.attribution?.first_source, "instagram");
  assert.equal(order?.attribution?.first_campaign, "agege-ig");
  assert.equal(order?.attribution?.story_id, w.story.id);
  assert.equal(order?.attribution?.place_id, w.place.id);
  assert.equal(order?.attribution?.ref_type, "place", "immediate Hapnin context kept separately from the first source");
  assert.equal(order?.total_cents, 0, "attribution never touches price");
});

test("paid order via the webhook path: attribution rides pending order → order; amounts unchanged", async () => {
  const w = await world({ price_cents: 3500 });
  const created: Record<string, unknown>[] = [];
  const stripe = installFakeStripe() as unknown as Record<string, unknown>;
  void stripe;
  setStripeForTests({
    paymentIntents: {
      create: async (params: Record<string, unknown>) => { created.push(params); return { id: "pi_qa_paid_000001", client_secret: "secret_qa" }; },
      retrieve: async (id: string) => ({ id, status: "succeeded", metadata: {} }),
      cancel: async (id: string) => ({ id }),
    },
    refunds: { create: async () => ({ id: "re_x" }) },
  });
  const a = journey(w.story.id, w.place.id);
  const withoutAttr = await createCheckoutIntent({ slug: w.event.slug, tierId: w.tierId, quantity: 1, buyer, referral_source: null, promoter_code: null, promo_code: null, friend_code: null, friends: [], ip: null, user_agent: null });
  const r = await createCheckoutIntent({ slug: w.event.slug, tierId: w.tierId, quantity: 1, buyer, referral_source: referralSourceFrom(a), promoter_code: null, promo_code: null, friend_code: null, friends: [], attribution: a, ip: null, user_agent: null });
  assert.equal(r.kind, "pay");
  assert.deepEqual(created[0].amount, created[1].amount, "same price with or without attribution");
  assert.equal(JSON.stringify(created[1]).includes("instagram"), false, "nothing about attribution is sent to Stripe");
  assert.equal(withoutAttr.kind, "pay");

  const pending = (await getDb().collection("pending_orders").where("payment_intent_id", "==", "pi_qa_paid_000001").get()).docs;
  assert.equal(pending.length, 2);
  const mine = pending.find((d) => d.data().attribution)!;
  const orderId = await fulfillPaidOrder(mine.id, "pi_qa_paid_000001");
  const order = await data(`orders/${orderId}`);
  assert.equal(order?.attribution?.story_id, w.story.id);
  assert.equal(order?.referral_source, "instagram");
  assert.equal(order?.subtotal_cents, 3500);
});

test("the admin funnel answers the pilot questions for the story and the place", async () => {
  const w = await world({ price_cents: 0 });
  const a = journey(w.story.id, w.place.id);
  await simulateBrowsing(a, { story: w.story.id, place: w.place.id, event: w.event.id });
  // A second visit from TikTok that only watched the story.
  await recordDiscoveryEvent({ name: "story_viewed", attribution: sanitizeAttribution({ visit_id: "v_qa_tiktok", first_source: "tiktok" })!, story_id: w.story.id, place_id: null, event_id: null, path: "/stories/qa-story" });
  await createCheckoutIntent({ slug: w.event.slug, tierId: w.tierId, quantity: 2, buyer, referral_source: "instagram", promoter_code: null, promo_code: null, friend_code: null, friends: [], attribution: a, ip: null, user_agent: null });

  const sf = await getStoryFunnel(w.story.id);
  assert.equal(sf.views.visits, 2);
  assert.deepEqual(sf.sources.map((s) => s.source).sort(), ["instagram", "tiktok"]);
  const step = (f: typeof sf, label: string) => f.steps.find((s) => s.label === label)!.visits;
  assert.equal(step(sf, "Played the video"), 1);
  assert.equal(step(sf, "Story → Place"), 1);
  assert.equal(step(sf, "Reached an event page (any path)"), 1);
  assert.equal(step(sf, "Reached checkout"), 1);
  assert.equal(sf.purchases.orders, 1);
  assert.equal(sf.purchases.tickets, 2);
  assert.equal(sf.campaigns[0]?.campaign, "agege-ig");

  const pf = await getPlaceFunnel(w.place.id);
  assert.equal(pf.views.visits, 1);
  assert.equal(step(pf, "Arrived from a Hapnin story"), 1);
  assert.equal(step(pf, "Instagram"), 1);
  assert.equal(step(pf, "Place → Event"), 1);
  assert.equal(step(pf, "Reached checkout"), 1);
  assert.equal(pf.purchases.orders, 1);
});

test("demo (sample) orders never count as experiment results", async () => {
  const w = await world({ price_cents: 2500, is_sample: true });
  const a = journey(w.story.id, w.place.id);
  const r = await createCheckoutIntent({ slug: w.event.slug, tierId: w.tierId, quantity: 1, buyer, referral_source: "instagram", promoter_code: null, promo_code: null, friend_code: null, friends: [], attribution: a, ip: null, user_agent: null });
  assert.equal(r.kind, "demo");
  assert.equal((await getStoryFunnel(w.story.id)).purchases.orders, 0);
});

test("forged or oversized attribution is reduced to safe fields before it is stored", async () => {
  const w = await world({ price_cents: 0 });
  const forged = sanitizeAttribution({ visit_id: "v_x", first_source: "<script>", story_id: "../../x", place_id: w.place.id, email: "a@b.c", ip: "1.1.1.1" });
  const r = await createCheckoutIntent({ slug: w.event.slug, tierId: w.tierId, quantity: 1, buyer, referral_source: referralSourceFrom(forged), promoter_code: null, promo_code: null, friend_code: null, friends: [], attribution: forged, ip: null, user_agent: null });
  const order = await data(`orders/${(r as { orderId: string }).orderId}`);
  assert.equal(order?.attribution?.first_source, "script");
  assert.equal(order?.attribution?.story_id, null);
  assert.equal("email" in order!.attribution, false);
  assert.equal("ip" in order!.attribution, false);
});
