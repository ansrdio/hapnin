import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

export default function robots(): MetadataRoute.Robots {
  return {
    // /pitch and /why are direct-link pages shared in DMs — keep them out of search.
    rules: { userAgent: "*", allow: "/", disallow: ["/pitch", "/why"] },
    host: siteUrl,
  };
}
