import type { MetadataRoute } from "next";
import { listOnSaleEvents } from "@/lib/events";
import { listPublishedPlaces } from "@/lib/places";
import { listPublishedStories } from "@/lib/stories";

// Static pages plus every on-sale event page, so events get indexed while
// they're actually buyable. Canonical host is www. Regenerated hourly.
export const revalidate = 3600;

const BASE = "https://www.hapnin.now";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = ["", "/discover", "/places", "/stories", "/host", "/create", "/tickets", "/terms", "/privacy"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/discover" ? "daily" : "weekly",
    priority: p === "" ? 1 : 0.7,
  }));

  let events: MetadataRoute.Sitemap = [];
  try {
    events = (await listOnSaleEvents(200)).map((e) => ({
      url: `${BASE}/e/${e.slug}`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    }));
  } catch (err) {
    // Never fail the sitemap because the database is unreachable at build time.
    console.warn("sitemap: could not list events", err);
  }

  // Published places and stories only — drafts never reach the sitemap.
  let content: MetadataRoute.Sitemap = [];
  try {
    const [places, stories] = await Promise.all([listPublishedPlaces(500), listPublishedStories(500)]);
    content = [
      ...places.map((p) => ({ url: `${BASE}/places/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : now, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...stories.map((s) => ({ url: `${BASE}/stories/${s.slug}`, lastModified: s.updated_at ? new Date(s.updated_at) : now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ];
  } catch (err) {
    console.warn("sitemap: could not list places/stories", err);
  }

  return [...statics, ...events, ...content];
}
