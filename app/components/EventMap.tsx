"use client";

import { useEffect, useRef, useState } from "react";

// The venue on a dark map, the way a Posh page shows it. Tapping anywhere on
// it opens the phone's maps app: Apple Maps on iPhone, Google Maps elsewhere.
// The map is a picture, not a control — no dragging or zooming, just the pin
// and the tap.

declare global {
  interface Window {
    maplibregl?: MapLibreLike;
    __hapninMaplibre?: Promise<MapLibreLike>;
  }
}
type MapLibreMap = { remove: () => void; on: (ev: string, fn: () => void) => void };
type MapLibreLike = {
  Map: new (opts: Record<string, unknown>) => MapLibreMap;
  Marker: new (opts: Record<string, unknown>) => { setLngLat: (c: [number, number]) => { addTo: (m: MapLibreMap) => unknown } };
};

// MapLibre GL from cdnjs + OpenFreeMap's dark style: no API key, free for
// production, vector tiles so the pin colour and the labels stay crisp.
const MAPLIBRE_JS = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js";
const MAPLIBRE_CSS = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

function loadMapLibre(): Promise<MapLibreLike> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!window.__hapninMaplibre) {
    window.__hapninMaplibre = new Promise((resolve, reject) => {
      if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = MAPLIBRE_CSS;
        document.head.appendChild(link);
      }
      const s = document.createElement("script");
      s.src = MAPLIBRE_JS;
      s.async = true;
      s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre missing")));
      s.onerror = () => reject(new Error("maplibre failed"));
      document.head.appendChild(s);
    });
  }
  return window.__hapninMaplibre;
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
    let map: MapLibreMap | null = null;
    let cancelled = false;
    loadMapLibre()
      .then((ml) => {
        if (cancelled || !el.current) return;
        map = new ml.Map({
          container: el.current,
          style: STYLE_DARK,
          center: [lng, lat],
          zoom: 14.6,
          interactive: false,
          attributionControl: { compact: true },
        });
        const pin = document.createElement("div");
        pin.style.cssText = `width:22px;height:22px;border-radius:50%;background:${accent};border:3px solid #1B0A2A;box-shadow:0 0 0 12px ${accent}33, 0 6px 18px rgba(0,0,0,.5)`;
        new ml.Marker({ element: pin, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
        map.on("load", () => setReady(true));
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
