"use client";

import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={share}
      aria-label="Share event"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-plum-hi bg-plum/60 text-mauve-dim backdrop-blur transition-colors hover:border-gold hover:text-cream"
    >
      {copied ? (
        <span className="text-xs font-semibold text-gold">✓</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M12 3v13M12 3l-4 4M12 3l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
