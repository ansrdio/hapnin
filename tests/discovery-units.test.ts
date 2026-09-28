// Experiment 001 pure pieces: video links, story body, source detection,
// attribution sanitizing, place + story form parsing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideoUrl } from "../lib/video.ts";
import { parseStoryBody } from "../lib/story-body.ts";
import { deriveFirstSource, sanitizeAttribution, referralSourceFrom, cleanToken } from "../lib/attribution.ts";
import { parsePlaceForm, parseOfferings, normalizeWebUrl, slugifyName } from "../lib/place-input.ts";
import { parseStoryForm, eventSlugFromRef } from "../lib/story-input.ts";
import { PLACE_CATEGORIES, CATEGORIES, isPlaceCategory } from "../lib/taxonomy.ts";

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

// ── video ──
test("YouTube links in every common shape resolve to the no-cookie player", () => {
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=4", "youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
    const v = parseVideoUrl(u);
    assert.equal(v?.provider, "youtube", u);
    assert.equal(v?.id, "dQw4w9WgXcQ");
    assert.ok(v?.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
    assert.equal(v?.thumbnailUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  }
});
test("Vimeo links resolve, private hashes are kept", () => {
  assert.equal(parseVideoUrl("https://vimeo.com/123456789")?.embedUrl, "https://player.vimeo.com/video/123456789?autoplay=1&dnt=1");
  assert.ok(parseVideoUrl("https://vimeo.com/123456789/abcdef1234")?.embedUrl.endsWith("&h=abcdef1234"));
});
test("anything else is not a video", () => {
  for (const u of ["", "not a url", "https://example.com/video.mp4", "https://youtube.com/watch?v=short", "javascript:alert(1)"]) assert.equal(parseVideoUrl(u), null, u);
});

// ── story body ──
test("story body: blank lines split paragraphs, '## ' makes a heading, nothing else is markup", () => {
  const b = parseStoryBody("Intro line one\nline two\n\n## The kitchen\nWhere it starts.\n\n<script>x</script>");
  assert.deepEqual(b, [
    { kind: "paragraph", text: "Intro line one\nline two" },
    { kind: "heading", text: "The kitchen" },
    { kind: "paragraph", text: "Where it starts." },
    { kind: "paragraph", text: "<script>x</script>" },
  ]);
  assert.deepEqual(parseStoryBody("   "), []);
});

// ── source detection ──
const at = (search: string, referrer = "") => deriveFirstSource({ search, referrer, selfHost: "www.hapnin.now" });
test("UTM tags win and channel aliases normalise", () => {
  assert.deepEqual(at("?utm_source=IG&utm_medium=social&utm_campaign=Agege Launch"), { source: "instagram", medium: "social", campaign: "agege-launch", referrer_host: null });
  assert.equal(at("?utm_source=tiktok").source, "tiktok");
});
test("?src= covers QR codes and partner links", () => {
  assert.deepEqual(at("?src=qr-agege"), { source: "qr", medium: null, campaign: "qr-agege", referrer_host: null });
  assert.equal(at("?src=agege-ig").source, "instagram");
  assert.equal(at("?src=agege").source, "partner");
});
test("referrers map to channels; our own host is an internal hop", () => {
  assert.equal(at("", "https://l.instagram.com/?u=x").source, "instagram");
  assert.equal(at("", "https://www.youtube.com/").source, "youtube");
  assert.equal(at("", "https://www.google.com/").source, "search");
  assert.deepEqual(at("", "https://blog.example.org/post"), { source: "referral", medium: null, campaign: null, referrer_host: "blog.example.org" });
  assert.equal(at("", "https://hapnin.now/places").source, "direct");
  assert.equal(at("").source, "direct");
});
test("tokens are cleaned, never passed through raw", () => {
  assert.equal(cleanToken("  Agege <b>IG</b> "), "agege-b-ig-b");
  assert.equal(cleanToken(""), null);
});

// ── attribution sanitizing (server side) ──
test("sanitizeAttribution keeps well-formed fields and drops everything else", () => {
  const a = sanitizeAttribution({
    visit_id: "v_abc123", first_source: "Instagram", first_campaign: "agege-ig", landing_path: "/stories/agege?utm_source=ig",
    referrer_host: "l.instagram.com", story_id: "story1", place_id: "place1", ref_type: "place", ref_id: "place1",
    ip: "1.2.3.4", user_agent: "x", email: "a@b.c",
  });
  assert.deepEqual(a, {
    visit_id: "v_abc123", first_source: "instagram", first_medium: null, first_campaign: "agege-ig", landing_path: "/stories/agege?utm_source=ig",
    referrer_host: "l.instagram.com", story_id: "story1", place_id: "place1", ref_type: "place", ref_id: "place1",
  });
  assert.equal("ip" in (a as object), false);
  assert.equal(sanitizeAttribution({ first_source: "x" }), null, "no visit id → nothing");
  assert.equal(sanitizeAttribution({ visit_id: "bad id!" }), null);
  assert.equal(sanitizeAttribution({ visit_id: "v1", ref_type: "event", ref_id: "e1" })?.ref_id, null);
  assert.equal(sanitizeAttribution({ visit_id: "v1", landing_path: "//evil.example" })?.landing_path, null);
  assert.equal(referralSourceFrom(a), "instagram");
  assert.equal(referralSourceFrom(null), null);
});

// ── places ──
test("place categories are their own vocabulary, not event categories", () => {
  assert.ok(PLACE_CATEGORIES.length >= 8);
  assert.ok(isPlaceCategory("restaurant"));
  assert.equal(isPlaceCategory("nightlife"), false);
  assert.ok(CATEGORIES.some((c) => c.id === "nightlife"), "event taxonomy untouched");
});
test("place form: required fields, many cultural tags, offerings, links", () => {
  const { values, fieldErrors } = parsePlaceForm(form({
    name: "Agege Test Kitchen", category: "restaurant", city: "Phoenix", state: "AZ",
    scene_tags: ["nigerian", "ghanaian", "pan_african", "nope"], custom_tags: ["Lagos street food"], languages: ["yoruba", "english", "klingon"],
    website: "agege.example.com", instagram: "@agege.phx", phone: "(602) 555-0142",
    offerings: "Suya — grilled to order\nJollof rice\nPuff-puff: sweet, fried", gallery: ["https://img.example/1.jpg"],
  }));
  assert.deepEqual(fieldErrors, {});
  assert.equal(values.slug, "agege-test-kitchen");
  assert.deepEqual(values.scene_tags, ["nigerian", "ghanaian", "pan_african"], "multiple cultures, unknown ids dropped");
  assert.deepEqual(values.languages, ["yoruba", "english"]);
  assert.equal(values.website, "https://agege.example.com/");
  assert.equal(values.instagram, "agege.phx");
  assert.equal(values.phone, "+16025550142");
  assert.deepEqual(values.offerings, [{ name: "Suya", details: "grilled to order" }, { name: "Jollof rice", details: null }, { name: "Puff-puff", details: "sweet, fried" }]);
});
test("place form: bad input is an error, not silently kept", () => {
  const { fieldErrors } = parsePlaceForm(form({ name: "", category: "nightlife", city: "", state: "", website: "not a site", phone: "123", hero_image_url: "http://insecure.example/x.jpg", gallery: ["ftp://x"] }));
  for (const k of ["name", "category", "city", "state", "website", "phone", "hero_image_url", "gallery"]) assert.ok(fieldErrors[k], k);
});
test("helpers: slugs, urls, offerings limits", () => {
  assert.equal(slugifyName("Àgégé Bites & Co."), "agege-bites-co");
  assert.equal(normalizeWebUrl(""), null);
  assert.equal(normalizeWebUrl("localhost"), undefined);
  assert.ok(parseOfferings(Array.from({ length: 13 }, (_, i) => `Item ${i}`).join("\n")).error);
});

// ── stories ──
test("story form: video must be YouTube/Vimeo; events by link or slug; places by id", () => {
  const ok = parseStoryForm(form({ title: "Inside the Culture — Test", video_url: "https://youtu.be/dQw4w9WgXcQ", place_ids: ["p1", "p1", "p2"], event_refs: "https://www.hapnin.now/e/taste-of-nigeria\n/e/second-one" }));
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.values.video_url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.deepEqual(ok.values.place_ids, ["p1", "p2"]);
  assert.deepEqual(ok.values.event_refs, ["taste-of-nigeria", "second-one"]);
  const bad = parseStoryForm(form({ title: "", video_url: "https://example.com/v.mp4", event_refs: "!!!" }));
  for (const k of ["title", "video_url", "event_refs"]) assert.ok(bad.fieldErrors[k], k);
  assert.equal(eventSlugFromRef("https://hapnin.now/e/Taste-Of-Nigeria?src=qr"), "taste-of-nigeria");
});
