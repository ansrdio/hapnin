// Regression tests for the event classification release: genre retired from
// the organizer UI (stored values untouched), custom tags, and Discover's
// use of them. Runs on Node's built-in test runner:  npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClassification } from "../lib/classification.ts";
import { buildEventDetailsUpdate, type EventDetailsUpdate } from "../lib/event-update.ts";
import { parseCustomTags, normalizeCustomTag, SCENE_TAGS, CUSTOM_TAG_MAX } from "../lib/taxonomy.ts";
import { GENRE } from "../lib/enums.ts";

const base: EventDetailsUpdate = {
  title: "Owambe Night",
  description: null,
  venue_name: "The Pemberton",
  venue_address: "1121 N 2nd St",
  venue_zip: "85004",
  city: "Phoenix",
  state: "AZ",
  starts_at: 1_800_000_000_000,
  capacity: 200,
  refund_policy: "none",
  referral_off_cents: 0,
  category: "culture",
  scene_tags: ["owambe", "nigerian"],
  custom_tags: [],
  primary_language: null,
  talent: [],
};

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

// ── genre: retired from the UI, retained in storage ──────────────────────────

test("every meaningful legacy genre has a canonical scene tag", () => {
  const ids = new Set<string>(SCENE_TAGS.map((t) => t.id));
  for (const g of GENRE) if (g !== "other") assert.ok(ids.has(g), `genre "${g}" needs a canonical scene tag`);
});

test("an edit payload never carries a genre key, so an existing genre survives an unrelated edit", () => {
  const payload = buildEventDetailsUpdate({ ...base, title: "Owambe Night · 2nd edition" });
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "genre"), false);
  assert.equal(payload.title, "Owambe Night · 2nd edition");
});

test("a submitted genre field is ignored, not persisted", () => {
  const p = parseClassification(form({ category: "nightlife", genre: "afrobeats" }));
  assert.equal("genre" in p, false);
});

test("language: Not specified parses to null and is written as an explicit null", () => {
  const p = parseClassification(form({ category: "culture", primary_language: "" }));
  assert.equal(p.primary_language, null);
  const payload = buildEventDetailsUpdate({ ...base, primary_language: null });
  assert.ok(Object.prototype.hasOwnProperty.call(payload, "primary_language"));
  assert.equal(payload.primary_language, null);
});

test("legacy compatibility fields never invent a genre or language", () => {
  const payload = buildEventDetailsUpdate(base);
  assert.equal(payload.event_type, "cultural");
  assert.equal(payload.community, "nigerian");
  assert.equal(payload.primary_language, null);
  assert.equal("genre" in payload, false);
});

// ── scene tags ───────────────────────────────────────────────────────────────

test("scene tags are read with getAll, not just the first chip", () => {
  const p = parseClassification(form({ category: "nightlife", scene_tags: ["amapiano", "south_african", "day_party"] }));
  assert.deepEqual(p.scene_tags, ["amapiano", "south_african", "day_party"]);
});

// ── custom tags ──────────────────────────────────────────────────────────────

test("valid custom tags are kept as typed", () => {
  const r = parseCustomTags(["Lagos Link-Up", "Owanbe & Chill"]);
  assert.equal(r.error, null);
  assert.deepEqual(r.tags, ["Lagos Link-Up", "Owanbe & Chill"]);
});

test("maximum three custom tags", () => {
  const r = parseCustomTags(["One tag", "Two tag", "Three tag", "Four tag"]);
  assert.notEqual(r.error, null);
  assert.deepEqual(r.tags, []);
  assert.ok(r.error!.includes(String(CUSTOM_TAG_MAX)));
});

test("case-insensitive duplicates collapse to the first spelling", () => {
  const r = parseCustomTags(["Lagos Link-Up", "lagos link-up", "LAGOS LINK-UP"]);
  assert.equal(r.error, null);
  assert.deepEqual(r.tags, ["Lagos Link-Up"]);
});

test("a custom tag that matches a canonical id or label is rejected, including spacing and hyphen variants", () => {
  for (const raw of ["Day Party", "day-party", "day_party", "AMAPIANO", "Pan-African", "pan african", "afro house"]) {
    const r = normalizeCustomTag(raw);
    assert.equal(r.ok, false, `"${raw}" should collide with a canonical tag`);
  }
});

test("Unicode letters and accents are accepted", () => {
  for (const raw of ["Ọ̀yọ́ Vibes", "Naïve Nights", "Ẹkọ́ Night", "Kwaśny Beat"]) {
    const r = normalizeCustomTag(raw);
    assert.equal(r.ok, true, `"${raw}" should be accepted`);
    if (r.ok) assert.equal(r.value, raw);
  }
});

test("whitespace is trimmed and collapsed, nothing else is rewritten", () => {
  const r = normalizeCustomTag("  Lagos   Link-Up  ");
  assert.deepEqual(r, { ok: true, value: "Lagos Link-Up" });
});

test("unsupported characters are a validation error, never silently stripped", () => {
  const r = parseCustomTags(["Lagos <b>Link</b>"]);
  assert.notEqual(r.error, null);
  assert.deepEqual(r.tags, []);
  const p = parseClassification(form({ category: "nightlife", custom_tags: ["#lagos"] }));
  assert.ok(p.fieldErrors.custom_tags);
  assert.deepEqual(p.custom_tags, []);
});

test("length limits: 2 to 24 characters", () => {
  assert.equal(normalizeCustomTag("A").ok, false);
  assert.equal(normalizeCustomTag("A".repeat(25)).ok, false);
  assert.equal(normalizeCustomTag("Ab").ok, true);
  assert.equal(normalizeCustomTag("A".repeat(24)).ok, true);
});

test("custom tags are read with getAll and written on edit", () => {
  const p = parseClassification(form({ category: "nightlife", custom_tags: ["Lagos Link-Up", "Rooftop"] }));
  assert.deepEqual(p.custom_tags, ["Lagos Link-Up", "Rooftop"]);
  const payload = buildEventDetailsUpdate({ ...base, custom_tags: p.custom_tags });
  assert.deepEqual(payload.custom_tags, ["Lagos Link-Up", "Rooftop"]);
});

// ── clone / series ───────────────────────────────────────────────────────────

test("cloning preserves custom_tags (the clone input is built from the source record)", async () => {
  // lib/series.ts and the duplicate action spread source.custom_tags into createEvent;
  // assert the source of truth by reading the module text so a regression is caught without Firestore.
  const { readFileSync } = await import("node:fs");
  for (const f of ["lib/series.ts", "app/o/actions.ts"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    assert.ok(/custom_tags:\s*source\.custom_tags/.test(src), `${f} must carry custom_tags on clone`);
  }
});

// ── Discover ────────────────────────────────────────────────────────────────

test("Discover search includes custom_tags; they are never filter options", async () => {
  const { readFileSync } = await import("node:fs");
  const client = readFileSync(new URL("../app/discover/DiscoverClient.tsx", import.meta.url), "utf8");
  assert.ok(/c\.custom_tags\.join\(" "\)/.test(client), "search haystack must include custom_tags");
  // The only filter vocabularies come from the canonical taxonomy.
  assert.ok(/CATEGORIES\.filter/.test(client) && /SCENE_TAGS\.filter/.test(client));
  assert.equal(/custom_tags/.test(client.split("const results = useMemo")[0].split("// Only offer the choices")[1] ?? ""), false, "no filter built from custom_tags");
  assert.equal(/aria-label="Custom/.test(client), false);
});
