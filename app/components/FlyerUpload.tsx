"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/app/components/ui";

// Reusable flyer picker. Uploads to /api/upload/flyer on select, previews the
// result, and keeps the resulting URL in a hidden input named `flyer_url` so the
// surrounding form submits it — plus the flyer's dominant colour in
// `flyer_color`, read from the file locally before upload (so the event page
// can tint itself to the flyer, the way a good flyer takes over the room).
export function FlyerUpload({
  name = "flyer_url",
  colorName = "flyer_color",
  initialUrl = "",
  initialColor = "",
  endpoint = "/api/upload/flyer",
}: {
  name?: string;
  colorName?: string;
  initialUrl?: string;
  initialColor?: string;
  endpoint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [color, setColor] = useState(initialColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const [picked, uploaded] = await Promise.all([dominantColor(file).catch(() => ""), upload(file, endpoint)]);
      setUrl(uploaded);
      setColor(picked);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={colorName} value={url ? color : ""} />
      <div className="flex items-start gap-4">
        <div
          className="relative flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-plum-hi bg-ink/50"
          style={url && color ? { boxShadow: `0 0 0 2px ${color}55, 0 12px 30px -12px ${color}` } : undefined}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Flyer preview" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-mauve-dim">No flyer yet</span>
          )}
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-ink/70 text-xs text-cream">Uploading…</div>}
        </div>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={buttonClass("secondary")}>
            {url ? "Replace image" : "Upload flyer"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setColor("");
              }}
              className="block text-sm text-mauve-dim transition-colors hover:text-coral"
            >
              Remove
            </button>
          )}
          <p className="text-xs text-mauve-dim/80">JPG, PNG, or WebP · up to 6 MB. Portrait works best.</p>
          {url && color && (
            <p className="flex items-center gap-2 text-xs text-mauve-dim/80">
              <span className="inline-block h-3 w-3 rounded-full border border-white/20" style={{ background: color }} aria-hidden="true" />
              Your event page will take this colour from the flyer.
            </p>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
      </div>
    </div>
  );
}

async function upload(file: File, endpoint: string): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(endpoint, { method: "POST", body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data.url as string;
}

/**
 * The flyer's dominant colour, read from the local file (no CORS worries).
 * Downsample to 40px, keep pixels with real saturation and mid lightness,
 * bucket them by hue, and average the biggest bucket. Falls back to the
 * plain average for flyers that are mostly black/white/grey.
 */
async function dominantColor(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close?.();
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (data[i + 3] < 128) continue;
    ar += r; ag += g; ab += b; an++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)) / 255;
    if (sat < 0.28 || l < 0.14 || l > 0.86) continue;
    let h = 0;
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    const bucket = Math.floor(((h < 0 ? h + 6 : h) / 6) * 24);
    const w = sat; // saturated pixels count for more
    const cur = buckets.get(bucket) ?? { r: 0, g: 0, b: 0, w: 0 };
    cur.r += r * w; cur.g += g * w; cur.b += b * w; cur.w += w;
    buckets.set(bucket, cur);
  }
  let best: { r: number; g: number; b: number; w: number } | null = null;
  for (const v of buckets.values()) if (!best || v.w > best.w) best = v;
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  if (best && best.w >= 8) return `#${hex(best.r / best.w)}${hex(best.g / best.w)}${hex(best.b / best.w)}`;
  if (an === 0) return "";
  return `#${hex(ar / an)}${hex(ag / an)}${hex(ab / an)}`;
}
