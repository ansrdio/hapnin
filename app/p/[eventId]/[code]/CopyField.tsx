"use client";

import { useState } from "react";

export function CopyField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-mauve-dim outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="shrink-0 rounded-xl bg-gold px-5 py-3 font-display text-sm font-semibold text-ink transition-colors hover:bg-gold-hi"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
