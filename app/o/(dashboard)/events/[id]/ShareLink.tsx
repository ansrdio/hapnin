"use client";

import { useState } from "react";
import { inputClass, buttonClass } from "@/app/components/ui";

export function ShareLink({ url, disabled }: { url: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className="flex gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} text-mauve-dim`} />
      <button type="button" onClick={copy} disabled={disabled} className={buttonClass("secondary")}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
