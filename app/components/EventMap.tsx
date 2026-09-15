"use client";

import { useEffect, useRef, useState } from "react";

// The venue on a dark map, the way a Posh page shows it. Tapping anywhere on
// it opens the phone's maps app: Apple Maps on iPhone, Google Maps elsewhere.
// Leaflet + CARTO's dark tiles (no API key); the map is a picture, not a
// control — no dragging or zooming, just the pin and the tap.

declare global {
  interface Window {
    L?: LeafletLike;
    __hapninLeaflet?: Promise<LeafletLike>;
  }
}
type LeafletLike = {
  map: (el: HTMLElement, opts: Record<string, unknown>) => { setView: (c: [number, number], z: number) => unknown; remove: () => void };
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: unknown) => unknown };
  circleMarker: (c: [number, number], opts: Record<string, unknown>) => { addTo: (m: unknown) => unknown };
};

const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";

function loadLeaflet(): Promise<LeafletLike> {
  if (window.L) return Promise.resolve(window.L);
  if (!window.__hapninLeaflet) {
    window.__hapninLeaflet = new Promise((resolve, reject) => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.async = true;
      s.onload = () => (window.L ? resolve(window.L) : reject(new Error("leaflet missing")));
      s.onerror = () => reject(new Error("leaflet failed"));
      document.head.appendChild(s);
    });
  }
  return window.__hapninLeaflet;
}

/** Deep link that opens the native maps app for this platform. */
export function mapsHref(input: { lat: number | null; lng: number | null; label: string; address: string }): string {
  const isApple = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const q = encodeURIComponent(`${input.label}, ${input.address}`);
  if (isApple) {
    return input.lat != null && input.lng != null
      ? `https://maps.apple.com/?q=${encodeURIComponent(input.label)}&ll=${input.lat},${input.lng}`
      : `https://maps.apple.com/?q=${q}`;
  }
  return input.lat != null && input.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function EventMap({
  lat,
  lng,
  label,
  address,
  accent = "#F4B24C",
}: {
  lat: number | null;
  lng: number | null;
  label: string;
  address: string;
  accent?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [href, setHref] = useState(() => mapsHref({ lat, lng, label, address }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHref(mapsHref({ lat, lng, label, address }));
  }, [lat, lng, label, address]);

  useEffect(() => {
    if (lat == null || lng == null || !el.current) return;
    let map: ReturnType<LeafletLike["map"]> | null = null;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current) return;
        map = L.map(el.current, {
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false,
          tap: false,
          attributionControl: true,
        });
        map.setView([lat, lng], 15);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);
        L.circleMarker([lat, lng], { radius: 22, color: accent, weight: 0, fillColor: accent, fillOpacity: 0.22 }).addTo(map);
        L.circleMarker([lat, lng], { radius: 9, color: "#1B0A2A", weight: 2, fillColor: accent, fillOpacity: 1 }).addTo(map);
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, accent]);

  const hasPin = lat != null && lng != null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
      aria-label={`Open ${label} in Maps`}
    >
      {hasPin && (
        <div className="relative aspect-[16/10] w-full bg-[#0f0a17]">
          <div ref={el} className="absolute inset-0" style={{ opacity: ready ? 1 : 0, transition: "opacity .4s" }} />
          {!ready && <div className="absolute inset-0 animate-pulse bg-white/[0.04]" aria-hidden="true" />}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Location</p>
          <p className="mt-1 font-medium text-cream">{label}</p>
          <p className="truncate text-sm text-mauve-dim">{address}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 px-3.5 py-2 text-sm font-semibold text-cream transition-colors group-hover:border-gold group-hover:text-gold">
          Open in Maps ↗
        </span>
      </div>
    </a>
  );
}

/** Inline "Open in Maps" link (ticket page, emails' web views). */
export function MapsLink({ lat, lng, label, address }: { lat: number | null; lng: number | null; label: string; address: string }) {
  const [href, setHref] = useState(() => mapsHref({ lat, lng, label, address }));
  useEffect(() => setHref(mapsHref({ lat, lng, label, address })), [lat, lng, label, address]);
  return (
    <a href={href} target="_blank" rel="noopener" className="whitespace-nowrap text-gold hover:underline">
      Open in Maps ↗
    </a>
  );
}
