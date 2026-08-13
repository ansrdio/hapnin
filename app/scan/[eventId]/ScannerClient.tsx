"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

type Result = { kind: "valid" | "used" | "wrong_event" | "invalid"; name?: string | null; at?: number | null };

const COPY: Record<Result["kind"], { label: string; ok: boolean }> = {
  valid: { label: "Checked in", ok: true },
  used: { label: "Already checked in", ok: false },
  wrong_event: { label: "Wrong event", ok: false },
  invalid: { label: "Invalid ticket", ok: false },
};

export function ScannerClient({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ token: string; t: number }>({ token: "", t: 0 });

  const [count, setCount] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState("");

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

  async function handleToken(token: string) {
    const now = Date.now();
    // Debounce: ignore the same code within 3s, and don't overlap requests.
    if (busyRef.current) return;
    if (token === lastRef.current.token && now - lastRef.current.t < 3000) return;
    lastRef.current = { token, t: now };
    busyRef.current = true;
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, token }),
      });
      const data = await res.json();
      setResult({ kind: data.result, name: data.name, at: data.at });
      if (typeof data.count === "number") setCount(data.count);
      if (navigator.vibrate) navigator.vibrate(data.result === "valid" ? 60 : [40, 40, 40]);
    } catch {
      setResult({ kind: "invalid" });
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
          <Link href={`/scan/${eventId}/sell`} className="text-sm text-gold hover:text-gold-hi">
            Box office
          </Link>
          <span className="font-display text-sm text-cream">
            In: <span className="tabular-nums text-gold">{count ?? "—"}</span>
          </span>
        </div>
      </div>

      <div className="px-5">
        <p className="mb-3 font-display text-lg font-semibold text-cream">{eventTitle}</p>
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
        </div>
      )}
    </main>
  );
}
