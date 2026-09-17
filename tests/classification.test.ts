// Regression tests for clearing an event's optional genre / language.
//   npm test
// Runs on Node's built-in test runner with TypeScript stripped; no framework.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClassification } from "../lib/classification.ts";
import { buildEventDetailsUpdate, type EventDetailsUpdate } from "../lib/event-update.ts";

const base: Omit<EventDetailsUpdate, "genre" | "primary_language"> = {
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
  talent: [],
};

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

test("choosing 'Not specified' parses genre and language to null", () => {
  const p = parseClassification(form({ category: "culture", genre: "", primary_language: "" }));
  assert.equal(p.genre, null);
  assert.equal(p.primary_language, null);
  assert.deepEqual(p.fieldErrors, {});
});

test("a form that omits the optional fields entirely also parses to null (not an error)", () => {
  const p = parseClassification(form({ category: "comedy" }));
  assert.equal(p.genre, null);
  assert.equal(p.primary_language, null);
  assert.deepEqual(p.fieldErrors, {});
});

test("a real genre and language still parse", () => {
  const p = parseClassification(form({ category: "nightlife", genre: "amapiano", primary_language: "yoruba" }));
  assert.equal(p.genre, "amapiano");
  assert.equal(p.primary_language, "yoruba");
});

test("legacy genre 'other' is still a real value, so an unchanged form keeps it", () => {
  const p = parseClassification(form({ category: "culture", genre: "other" }));
  assert.equal(p.genre, "other");
});

test("scene tags are read with getAll, not just the first chip", () => {
  const p = parseClassification(form({ category: "nightlife", scene_tags: ["amapiano", "south_african", "day_party"] }));
  assert.deepEqual(p.scene_tags, ["amapiano", "south_african", "day_party"]);
});

test("clearing an existing genre and language writes explicit nulls (keys present, not omitted)", () => {
  const payload = buildEventDetailsUpdate({ ...base, genre: null, primary_language: null });
  assert.ok(Object.prototype.hasOwnProperty.call(payload, "genre"), "genre key must be present");
  assert.ok(Object.prototype.hasOwnProperty.call(payload, "primary_language"), "primary_language key must be present");
  assert.equal(payload.genre, null);
  assert.equal(payload.primary_language, null);
});

test("legacy compatibility fields never invent a genre or language", () => {
  const payload = buildEventDetailsUpdate({ ...base, genre: null, primary_language: null });
  assert.equal(payload.event_type, "cultural"); // legacy type still written
  assert.equal(payload.community, "nigerian"); // derived from the nigerian tag
  assert.equal(payload.genre, null); // not "other"
  assert.equal(payload.primary_language, null); // not "english"
});

test("a real genre chosen afterwards persists", () => {
  const payload = buildEventDetailsUpdate({ ...base, genre: "highlife", primary_language: "pidgin" });
  assert.equal(payload.genre, "highlife");
  assert.equal(payload.primary_language, "pidgin");
});

test("'other' category writes no legacy event_type rather than a made-up one", () => {
  const payload = buildEventDetailsUpdate({ ...base, category: "other", scene_tags: [], genre: null, primary_language: null });
  assert.equal(payload.event_type, null);
  assert.equal(payload.community, null);
});
