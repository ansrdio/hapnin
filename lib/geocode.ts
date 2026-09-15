import "server-only";

// Address → coordinates for the event-page map, via OpenStreetMap's Nominatim.
// Free, no key, but polite use is required: identify ourselves, one request
// per event (results are stored on the event), never in a hot loop. A miss
// returns null and the page simply shows the address without a map.
export async function geocodeAddress(parts: (string | null | undefined)[]): Promise<{ lat: number; lng: number } | null> {
  const q = parts.filter(Boolean).join(", ");
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Hapnin/1.0 (https://hapnin.now; jii@hapnin.now)", Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const r = rows[0];
    if (!r) return null;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
