// Basic in-memory sliding-window rate limiter, keyed by IP + bucket.
//
// This is intentionally simple: it lives in the server process memory, so on a
// serverless platform (Vercel) it limits per warm instance, not globally. That
// is enough to blunt casual abuse of a pre-launch signup form. For hard limits
// across instances, swap the Map for Upstash Redis (see README).

type Hit = number[]; // list of request timestamps (ms)

const store = new Map<string, Hit>();

// Occasionally evict cold keys so the map can't grow unbounded.
function sweep(now: number, windowMs: number) {
  if (store.size < 5000) return;
  for (const [k, hits] of store) {
    if (hits.length === 0 || now - hits[hits.length - 1] > windowMs) {
      store.delete(k);
    }
  }
}

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const { limit, windowMs } = opts;
  sweep(now, windowMs);

  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - hits[0])) / 1000);
    store.set(key, hits);
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  store.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers. Falls back to a shared bucket. */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
