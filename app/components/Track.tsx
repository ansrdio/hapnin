"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { deriveFirstSource, type Attribution } from "@/lib/attribution";

// Experiment 001 visit tracking. One VISIT per browser tab (sessionStorage),
// rolled over after 30 idle minutes. It remembers how the visit arrived and
// which story/place it has seen, so a later event view, checkout or purchase
// can be attributed to the journey. Nothing persists beyond the tab; storage
// failures (private mode, blocked storage) simply mean nothing is tracked.

const KEY = "hapnin_visit";
const IDLE_MS = 30 * 60 * 1000;

type Visit = Attribution & { last_at: number };

function read(): Visit | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Visit;
    return typeof v?.visit_id === "string" ? v : null;
  } catch {
    return null;
  }
}

function write(v: Visit) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: no tracking */
  }
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return "v_" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

/** The current visit, started here if none is live. First source is decided once, from this page's URL + referrer. */
export function ensureVisit(): Visit {
  const now = Date.now();
  const existing = read();
  const params = new URLSearchParams(window.location.search);
  const tagged = params.has("utm_source") || params.has("src");
  const src = deriveFirstSource({ search: window.location.search, referrer: document.referrer, selfHost: window.location.host });
  // A new campaign-tagged arrival (a different Instagram/QR/partner link)
  // starts a new visit, so each tagged link gets its own journey.
  const sameCampaign = !tagged || (existing?.first_source === src.source && existing?.first_campaign === src.campaign);
  if (existing && now - existing.last_at < IDLE_MS && sameCampaign) {
    existing.last_at = now;
    write(existing);
    return existing;
  }
  const v: Visit = {
    visit_id: newId(),
    first_source: src.source,
    first_medium: src.medium,
    first_campaign: src.campaign,
    landing_path: window.location.pathname + window.location.search.slice(0, 120),
    referrer_host: src.referrer_host,
    story_id: null,
    place_id: null,
    ref_type: null,
    ref_id: null,
    last_at: now,
  };
  write(v);
  return v;
}

/** Attribution as sent to the server (checkout, beacons). */
export function currentAttribution(): Attribution | null {
  try {
    const v = ensureVisit();
    const { last_at: _unused, ...a } = v; // eslint-disable-line @typescript-eslint/no-unused-vars
    return a;
  } catch {
    return null;
  }
}

type Subject = { place_id?: string | null; story_id?: string | null; event_id?: string | null };

export function track(name: string, subject: Subject = {}): void {
  const attribution = currentAttribution();
  if (!attribution) return;
  const body = JSON.stringify({ name, subject, attribution, path: window.location.pathname });
  try {
    const ok = navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }));
    if (!ok) void fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    /* never let measurement break the page */
  }
}

/** After a place/story view: remember it for the rest of the visit. */
function markSeen(kind: "story" | "place", id: string) {
  const v = read();
  if (!v) return;
  if (kind === "story") v.story_id = id;
  else v.place_id = id;
  write(v);
}

/** Before navigating on from a place/story: remember what they clicked from. */
function setRef(type: "story" | "place" | null, id: string | null) {
  const v = read();
  if (!v) return;
  v.ref_type = type;
  v.ref_id = id;
  write(v);
}

/** Root layout: starts the visit on whatever page someone lands on, so the first source is always the real one. */
export function VisitStart() {
  useEffect(() => {
    ensureVisit();
  }, []);
  return null;
}

/** Fire a view once on mount. `seen` marks the story/place for later attribution; `clearRef` resets the click context. */
export function TrackView({ name, subject, seen, clearRef = true }: { name: string; subject: Subject; seen?: { kind: "story" | "place"; id: string }; clearRef?: boolean }) {
  useEffect(() => {
    track(name, subject);
    if (seen) markSeen(seen.kind, seen.id);
    if (clearRef) setRef(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Event page: if this visit clicked through from a place or story, record the arrival. The click context is kept so checkout can carry it; the next place/story view resets it. */
export function EventArrival({ eventId }: { eventId: string }) {
  useEffect(() => {
    const v = read();
    if (!v || !v.ref_type || !v.ref_id) return;
    track(v.ref_type === "place" ? "event_viewed_from_place" : "event_viewed_from_story", {
      event_id: eventId,
      ...(v.ref_type === "place" ? { place_id: v.ref_id } : { story_id: v.ref_id }),
    });
  }, [eventId]);
  return null;
}

/** A link that records the click (and, for onward journeys, what it was clicked from). */
export function TrackedLink({
  href,
  name,
  subject,
  from,
  external = false,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  name: string;
  subject: Subject;
  from?: { type: "story" | "place"; id: string };
  external?: boolean;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const onClick = () => {
    track(name, subject);
    if (from) setRef(from.type, from.id);
  };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
