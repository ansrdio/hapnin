"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/app/components/ui";

// Reusable flyer picker. Uploads to /api/upload/flyer on select, previews the
// result, and keeps the resulting URL in a hidden input named `flyer_url` so the
// surrounding form submits it. Used by the event builder and the manage page.
export function FlyerUpload({ name = "flyer_url", initialUrl = "" }: { name?: string; initialUrl?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/flyer", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setUrl(data.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-4">
        <div className="relative flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-plum-hi bg-ink/50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Flyer preview" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-mauve-dim">No flyer yet</span>
          )}
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-ink/70 text-xs text-cream">Uploading…</div>}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            className="hidden"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={buttonClass("secondary")}>
            {url ? "Replace image" : "Upload flyer"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="block text-sm text-mauve-dim transition-colors hover:text-coral"
            >
              Remove
            </button>
          )}
          <p className="text-xs text-mauve-dim/80">JPG, PNG, or WebP · up to 6 MB. Portrait works best.</p>
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
      </div>
    </div>
  );
}
