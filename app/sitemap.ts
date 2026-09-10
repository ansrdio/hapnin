import type { MetadataRoute } from "next";
import { listOnSaleEvents } from "@/lib/events";

// Static pages plus every on-sale event page, so events get indexed while
// they're actually buyable. Canonical host is www. Regenerated hourly.
export const revalidate = 3600;

const BASE = "https://www.hapnin.now";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = ["", "/discover", "/host", "/create", "/tickets", "/why", "/terms", "/privacy"].map((p) => ({
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

  return [...statics, ...events];
}
