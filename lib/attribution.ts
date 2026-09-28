// Discovery attribution for Experiment 001 (Places + Inside the Culture).
// Client-safe and pure: the browser uses deriveFirstSource() when a visit
// starts; the server uses sanitizeAttribution() on anything the browser sends
// (tracking beacons and checkout) and never trusts it for money.
//
// Identifier: a VISIT id, not a visitor id. It lives in sessionStorage (dies
// with the tab) and rolls over after 30 idle minutes — enough to follow one
// journey (Instagram → Story → Place → Event → Checkout) and nothing longer.
// No cookie, no cross-session profile, no IP address, no browser fingerprint.

export type Attribution = {
  visit_id: string;
  /** How this visit arrived: instagram, tiktok, youtube, qr, facebook, x, whatsapp, search, partner, referral, direct. */
  first_source: string;
  first_medium: string | null;
  /** utm_campaign, or the whole ?src= value (e.g. "qr-agege", "agege-ig"). */
  first_campaign: string | null;
  landing_path: string | null;
  referrer_host: string | null;
  /** The last Story / Place this visit viewed before the current page. */
  story_id: string | null;
  place_id: string | null;
  /** The object that sent them to the current page (what they clicked from). */
  ref_type: "story" | "place" | null;
  ref_id: string | null;
};

const CHANNEL_ALIASES: Record<string, string> = {
  ig: "instagram", insta: "instagram", instagram: "instagram",
  tt: "tiktok", tiktok: "tiktok",
  yt: "youtube", youtube: "youtube",
  qr: "qr",
  fb: "facebook", facebook: "facebook",
  x: "x", twitter: "x",
  wa: "whatsapp", whatsapp: "whatsapp",
  email: "email", newsletter: "email",
};

const REFERRER_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, "facebook"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/, "search"],
];

/** lowercase, [a-z0-9._-] only, ≤ 60 chars; null when nothing usable is left. */
export function cleanToken(v: unknown, max = 60): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
  return s || null;
}

/**
 * Where a visit came from, decided once on its first page. Precedence: UTM
 * tags → our own ?src= tag (QR codes, partner links) → the referring site →
 * direct. A referrer on our own host counts as direct (an internal hop).
 */
export function deriveFirstSource(input: { search: string; referrer: string; selfHost: string }): {
  source: string;
  medium: string | null;
  campaign: string | null;
  referrer_host: string | null;
} {
  const params = new URLSearchParams(input.search);
  let referrer_host: string | null = null;
  try {
    referrer_host = input.referrer ? new URL(input.referrer).hostname.toLowerCase() : null;
  } catch {
    referrer_host = null;
  }
  const self = input.selfHost.toLowerCase().replace(/^www\./, "");
  if (referrer_host && referrer_host.replace(/^www\./, "") === self) referrer_host = null;

  const utmSource = cleanToken(params.get("utm_source"));
  if (utmSource) {
    return {
      source: CHANNEL_ALIASES[utmSource] ?? utmSource,
      medium: cleanToken(params.get("utm_medium")),
      campaign: cleanToken(params.get("utm_campaign")),
      referrer_host,
    };
  }
  const src = cleanToken(params.get("src"));
  if (src) {
    const channel = src.split(/[-_.]/).map((part) => CHANNEL_ALIASES[part]).find(Boolean);
    return { source: channel ?? "partner", medium: null, campaign: src, referrer_host };
  }
  if (referrer_host) {
    const hit = REFERRER_HOSTS.find(([re]) => re.test(referrer_host!));
    return { source: hit ? hit[1] : "referral", medium: null, campaign: null, referrer_host };
  }
  return { source: "direct", medium: null, campaign: null, referrer_host: null };
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const cleanId = (v: unknown): string | null => (typeof v === "string" && ID.test(v) ? v : null);
const cleanPath = (v: unknown): string | null =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v.slice(0, 200).replace(/[^\x21-\x7e]/g, "") || null : null;
const cleanHost = (v: unknown): string | null =>
  typeof v === "string" && /^[a-z0-9.-]{1,120}$/i.test(v) ? v.toLowerCase() : null;

/** Server-side: accept only well-formed fields; anything else becomes null. No visit id → null. */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const visit_id = cleanId(r.visit_id);
  if (!visit_id) return null;
  const ref_type = r.ref_type === "story" || r.ref_type === "place" ? r.ref_type : null;
  return {
    visit_id,
    first_source: cleanToken(r.first_source) ?? "direct",
    first_medium: cleanToken(r.first_medium),
    first_campaign: cleanToken(r.first_campaign),
    landing_path: cleanPath(r.landing_path),
    referrer_host: cleanHost(r.referrer_host),
    story_id: cleanId(r.story_id),
    place_id: cleanId(r.place_id),
    ref_type,
    ref_id: ref_type ? cleanId(r.ref_id) : null,
  };
}

/** The single value an order's referral_source records ("How they found it" on the organizer's analytics). */
export function referralSourceFrom(a: Attribution | null): string | null {
  return a ? a.first_source : null;
}
