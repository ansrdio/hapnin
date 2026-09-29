// Source-level guarantees for Experiment 001 that don't need a database:
// admin authorization, relationship preservation on duplicate/series, the
// checkout and canonical wiring, and the privacy constraints on tracking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("every admin content action and the image upload re-check the admin allowlist", () => {
  const actions = src("app/admin/content-actions.ts");
  const fns = [...actions.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n\s*await requireAdmin\(\);/g)].map((m) => m[1]);
  const all = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.equal(all.length, 8, "places: create, update, status, link, unlink · stories: create, update, status");
  assert.deepEqual(fns.sort(), all.sort(), "each action's first line is requireAdmin()");
  assert.match(src("app/api/upload/content-image/route.ts"), /await requireAdmin\(\);/);
  // Admin pages live under the admin layout, which calls requireAdmin().
  assert.match(src("app/admin/layout.tsx"), /await requireAdmin\(\)/);
});

test("duplicating an event and creating a series carry the Place link", () => {
  for (const f of ["app/o/actions.ts", "lib/series.ts"]) assert.match(src(f), /place_id:\s*source\.place_id/, f);
});

test("checkout sends the visit context and the server sanitizes it before use", () => {
  assert.match(src("app/e/[slug]/checkout/CheckoutClient.tsx"), /attribution:\s*currentAttribution\(\)/);
  const route = src("app/api/checkout/route.ts");
  assert.match(route, /sanitizeAttribution\(body\.attribution\)/);
  assert.match(route, /referralSourceFrom\(attribution\)/);
  assert.match(src("lib/checkout.ts"), /attribution:\s*p\.attribution \?\? null/);
});

test("the root layout no longer forces the homepage as every page's canonical", () => {
  const layout = src("app/layout.tsx");
  assert.equal(/alternates:\s*\{\s*canonical/.test(layout), false);
  assert.match(layout, /metadataBase: new URL\(CANONICAL_ORIGIN\)/);
  for (const f of ["app/page.tsx", "app/discover/page.tsx", "app/places/page.tsx", "app/stories/page.tsx", "app/host/page.tsx", "app/create/page.tsx", "app/tickets/page.tsx", "app/terms/page.tsx", "app/privacy/page.tsx"]) {
    assert.match(src(f), /alternates:\s*\{\s*canonical:/, f);
  }
  for (const f of ["app/e/[slug]/page.tsx", "app/places/[slug]/page.tsx", "app/stories/[slug]/page.tsx", "app/o/[handle]/page.tsx"]) {
    assert.match(src(f), /canonical: `\//, f);
  }
});

test("tracking stores no IP, user agent or persistent id", () => {
  const route = src("app/api/t/route.ts");
  const record = src("lib/discovery.ts").split("export async function recordDiscoveryEvent")[1].split("export type Funnel")[0];
  assert.equal(/ip|user_agent|userAgent/i.test(record.replace(/visit_id|first_|ref_|path|via_|landing|referrer_host|place_id|story_id|event_id|name|day|at/g, "")), false, "the stored doc has no ip/ua field");
  assert.match(route, /user-agent/, "UA is read only to drop crawlers");
  const client = src("app/components/Track.tsx");
  assert.match(client, /sessionStorage/);
  assert.equal(/localStorage|document\.cookie/.test(client), false, "no persistent storage");
});

test("the video player loads only after a tap", () => {
  const v = src("app/components/VideoFacade.tsx");
  assert.match(v, /useState\(false\)/);
  assert.match(v, /if \(playing\)[\s\S]*<iframe/);
});

test("the security policy adds only the two video origins", () => {
  const cfg = src("next.config.mjs");
  assert.match(cfg, /frame-src[^"]*https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/);
  assert.match(cfg, /img-src[^"]*https:\/\/i\.ytimg\.com/);
  assert.equal(/script-src[^"]*youtube/.test(cfg), false, "no YouTube scripts on our origin");
});

test("public pages never list drafts unless an admin asks for a preview", () => {
  for (const f of ["app/places/page.tsx", "app/stories/page.tsx"]) {
    assert.match(src(f), /preview === "1" && \(await isAdminViewer\(\)\)/, f);
  }
  for (const f of ["app/places/[slug]/page.tsx", "app/stories/[slug]/page.tsx"]) {
    assert.match(src(f), /status !== "published" && !admin\) notFound\(\)/, f);
  }
});

test("no new analytics dependency was added", () => {
  const pkg = JSON.parse(src("package.json"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  for (const bad of ["posthog-js", "@vercel/analytics", "mixpanel-browser", "@segment/analytics-next", "react-ga4"]) assert.equal(deps.includes(bad), false, bad);
});

void readdirSync;
void statSync;
