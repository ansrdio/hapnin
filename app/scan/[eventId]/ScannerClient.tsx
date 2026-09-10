"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

// The door scanner, with an offline mode for venues where the signal dies.
//
// Online:  every scan goes to /api/scan (HMAC-verified, first-scan-wins in a
//          transaction). The manifest is refreshed in the background.
// Offline: a scan is decided from the last manifest — the ticket id decoded
//          from the QR must be in this event's list and not yet used. Ticket
//          ids are unguessable (they're the secret half of the QR), so
//          membership is the check. Admits are queued and replayed through
//          /api/scan/sync the moment signal returns; if another phone got
//          there first the server says so and the door sees a conflict count.

type Kind = "valid" | "used" | "wrong_event" | "invalid" | "unknown_offline";
type Result = { kind: Kind; name?: string | null; at?: number | null; offline?: boolean };

const COPY: Record<Kind, { label: string; ok: boolean }> = {
  valid: { label: "Checked in", ok: true },
  used: { label: "Already checked in", ok: false },
  wrong_event: { label: "Wrong event", ok: false },
  invalid: { label: "Invalid ticket", ok: false },
  unknown_offline: { label: "Not in the offline list", ok: false },
};

type ManifestTicket = { name: string; used_at: number | null };
type Manifest = { tickets: Record<string, ManifestTicket>; fetched_at: number };
type Queued = { id: string; at: number };

const mKey = (eventId: string) => `hapnin_manifest_${eventId}`;
const qKey = (eventId: string) => `hapnin_scanqueue_${eventId}`;
function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage may be unavailable; offline mode degrades to online-only */
  }
}

/** The QR is base64url(ticketId).signature — the id half is enough for a membership check. */
function ticketIdFromToken(token: string): string | null {
  const part = (token || "").split(".")[0];
  if (!part) return null;
  try {
    return atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

export function ScannerClient({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ token: string; t: number }>({ token: "", t: 0 });
  const manifestRef = useRef<Manifest | null>(null);
  const queueRef = useRef<Queued[]>([]);

  const [count, setCount] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState("");
  const [online, setOnline] = useState(true);
  const [manifestSize, setManifestSize] = useState<number | null>(null);
  const [queued, setQueued] = useState(0);
  const [conflicts, setConflicts] = useState(0);

  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/manifest?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { tickets: { id: string; name: string; used_at: number | null }[]; fetched_at: number };
      const tickets: Record<string, ManifestTicket> = {};
      for (const t of data.tickets) tickets[t.id] = { name: t.name, used_at: t.used_at };
      // Scans admitted offline but not yet synced stay "used" locally.
      for (const q of queueRef.current) if (tickets[q.id] && !tickets[q.id].used_at) tickets[q.id].used_at = q.at;
      const m: Manifest = { tickets, fetched_at: data.fetched_at };
      manifestRef.current = m;
      save(mKey(eventId), m);
      setManifestSize(Object.keys(tickets).length);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [eventId]);

  const syncQueue = useCallback(async () => {
    const items = queueRef.current;
    if (items.length === 0) return;
    try {
      const res = await fetch("/api/scan/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, items }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { results?: { id: string; result: string }[]; count?: number };
      const conflict = (data.results ?? []).filter((r) => r.result === "already_used").length;
      if (conflict) setConflicts((c) => c + conflict);
      queueRef.current = [];
      save(qKey(eventId), []);
      setQueued(0);
      if (typeof data.count === "number") setCount(data.count);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [eventId]);

  // Manifest + queue lifecycle: restore from storage, refresh while online,
  // sync the moment signal returns.
  useEffect(() => {
    manifestRef.current = load<Manifest | null>(mKey(eventId), null);
    queueRef.current = load<Queued[]>(qKey(eventId), []);
    if (manifestRef.current) setManifestSize(Object.keys(manifestRef.current.tickets).length);
    setQueued(queueRef.current.length);
    setOnline(navigator.onLine);
    void syncQueue().then(refreshManifest);
    const iv = setInterval(() => {
      if (navigator.onLine) void syncQueue().then(refreshManifest);
    }, 45_000);
    const on = () => {
      setOnline(true);
      void syncQueue().then(refreshManifest);
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(iv);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [eventId, refreshManifest, syncQueue]);

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let cancelled = false;
    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (res) => {
            if (res) handleToken(res.getText());
          }
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch {
        setCamError("Camera access is needed to scan. Allow it and reload.");
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function decideOffline(token: string): Result {
    const id = ticketIdFromToken(token);
    const m = manifestRef.current;
    if (!id || !m) return { kind: "unknown_offline", offline: true };
    const t = m.tickets[id];
    if (!t) return { kind: "unknown_offline", offline: true };
    if (t.used_at) return { kind: "used", name: t.name, at: t.used_at, offline: true };
    const at = Date.now();
    t.used_at = at;
    save(mKey(eventId), m);
    queueRef.current = [...queueRef.current, { id, at }];
    save(qKey(eventId), queueRef.current);
    setQueued(queueRef.current.length);
    setCount((c) => (c ?? 0) + 1);
    return { kind: "valid", name: t.name, offline: true };
  }

  async function handleToken(token: string) {
    const now = Date.now();
    // Debounce: ignore the same code within 3s, and don't overlap requests.
    if (busyRef.current) return;
    if (token === lastRef.current.token && now - lastRef.current.t < 3000) return;
    lastRef.current = { token, t: now };
    busyRef.current = true;
    let r: Result;
    try {
      if (!navigator.onLine) {
        r = decideOffline(token);
      } else {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, token }),
            signal: ctrl.signal,
          });
          clearTimeout(to);
          const data = await res.json();
          r = { kind: data.result, name: data.name, at: data.at };
          if (typeof data.count === "number") setCount(data.count);
          const id = ticketIdFromToken(token);
          if (id && data.result === "valid" && manifestRef.current?.tickets[id]) {
            manifestRef.current.tickets[id].used_at = Date.now();
            save(mKey(eventId), manifestRef.current);
          }
          setOnline(true);
        } catch {
          // No signal (or too slow) — decide from the manifest and queue it.
          setOnline(false);
          r = decideOffline(token);
        }
      }
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.kind === "valid" ? 60 : [40, 40, 40]);
    } finally {
      setTimeout(() => {
        busyRef.current = false;
        setResult(null);
      }, 2200);
    }
  }

  const banner = result ? COPY[result.kind] : null;

  return (
    <main className="relative min-h-[100svh] bg-ink">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/scan" className="text-sm text-mauve-dim hover:text-cream">← Events</Link>
        <div className="flex items-center gap-4">
          <Link href={`/scan/${eventId}/board`} className="text-sm text-mauve-dim hover:text-cream">
            Board
          </Link>
          <Link href={`/scan/${eventId}/sell`} className="text-sm text-gold hover:text-gold-hi">
            Box office
          </Link>
          <span className="font-display text-sm text-cream">
            In: <span className="tabular-nums text-gold">{count ?? "—"}</span>
          </span>
        </div>
      </div>

      <div className="px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold text-cream">{eventTitle}</p>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              online ? "border-emerald/40 text-emerald" : "border-coral/50 text-coral"
            }`}
          >
            {online
              ? `Online${manifestSize != null ? ` · ${manifestSize} tickets ready offline` : ""}`
              : `Offline${manifestSize != null ? ` · ${manifestSize} tickets on this phone` : " · no list yet"}${queued ? ` · ${queued} to sync` : ""}`}
          </span>
        </div>
        {conflicts > 0 && (
          <p className="mb-3 rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-cream">
            {conflicts} offline scan{conflicts === 1 ? " was" : "s were"} already used on another phone — worth a look at the door.
          </p>
        )}
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-plum-hi bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/40" />
        </div>
        {camError && <p className="mt-4 text-sm text-coral">{camError}</p>}
        {!camError && !result && <p className="mt-4 text-center text-mauve-dim">Point at a ticket QR.</p>}
      </div>

      {/* Result overlay */}
      {banner && (
        <div
          className={`fixed inset-x-0 bottom-0 top-auto flex flex-col items-center justify-center gap-2 px-6 py-10 ${
            banner.ok ? "bg-emerald" : "bg-coral"
          }`}
        >
          <div className="text-6xl">{banner.ok ? "✓" : "✕"}</div>
          <div className="font-display text-2xl font-bold text-ink">{banner.label}</div>
          {result?.name && <div className="text-lg font-medium text-ink/80">{result.name}</div>}
          {result?.kind === "used" && result.at && (
            <div className="text-sm text-ink/70">
              at {new Date(result.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>
          )}
          {result?.offline && <div className="text-xs text-ink/70">offline — will sync when signal’s back</div>}
        </div>
      )}
    </main>
  );
}
