"use client";

import { useRef, useState } from "react";

// Utilitarian image picker for the Place/Story admin forms. Uploads to the
// admin-only endpoint and keeps the resulting https URL(s) in hidden inputs.
// `multiple` = a gallery (ordered list, removable); otherwise a single image.

export function ImageField({
  name,
  kind,
  initial = [],
  multiple = false,
  max = 12,
}: {
  name: string;
  kind: "places" | "stories";
  initial?: string[];
  multiple?: boolean;
  max?: number;
}) {
  const [urls, setUrls] = useState<string[]>(initial.filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, multiple ? max - urls.length : 1)) {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", kind);
        const res = await fetch("/api/upload/content-image", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
        setUrls((prev) => (multiple ? [...prev, data.url] : [data.url]));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      {urls.map((u) => (
        <input key={u} type="hidden" name={name} value={u} />
      ))}
      {!multiple && urls.length === 0 && <input type="hidden" name={name} value="" />}
      {urls.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Uploaded image ${i + 1}`} className="h-24 w-24 rounded-xl border border-plum-hi object-cover" />
              <button type="button" onClick={() => setUrls((p) => p.filter((x) => x !== u))} className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-coral text-sm font-bold text-ink" aria-label={`Remove image ${i + 1}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {(multiple ? urls.length < max : true) && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-plum-hi px-4 py-2.5 text-sm font-semibold text-cream hover:border-gold">
          {busy ? "Uploading…" : multiple ? "Add images" : urls.length ? "Replace image" : "Upload image"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
      )}
      {error && <p className="mt-1 text-sm text-coral">{error}</p>}
    </div>
  );
}
