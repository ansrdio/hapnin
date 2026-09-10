"use client";

import { useState } from "react";

// A read-only link with a copy button. Falls back to selecting the text where
// the clipboard API isn't available (some in-app browsers).
export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-white/15 bg-ink/60 px-3.5 py-2.5 text-sm text-cream"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* the field is selectable; the user can copy by hand */
          }
        }}
        className="shrink-0 rounded-xl bg-gold px-4 py-2.5 font-display text-sm font-semibold text-ink transition-colors hover:bg-gold-hi"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
