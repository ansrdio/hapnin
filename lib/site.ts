// The one canonical origin. The apex (hapnin.now) and http both 308 to it, so
// canonical URLs, share URLs and the sitemap all use www. Client-safe.
export const CANONICAL_ORIGIN = "https://www.hapnin.now";

export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
