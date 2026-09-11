"use client";

import { useEffect, useState } from "react";

// "Add to home screen" for door staff — shown only in a normal browser tab
// (hidden once the page is already running as an installed app), with the
// right words for the phone they're holding.
export function AddToHomeHint() {
  const [state, setState] = useState<"hidden" | "ios" | "android" | "other">("hidden");
  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setState("ios");
    else if (/Android/.test(ua)) setState("android");
    else setState("other");
  }, []);
  if (state === "hidden" || state === "other") return null;
  return (
    <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/[0.05] px-5 py-4 text-sm">
      <p className="font-display font-semibold text-cream">Put the scanner on your home screen.</p>
      <p className="mt-1 text-mauve-dim">
        {state === "ios"
          ? "Tap the Share button in Safari, then “Add to Home Screen”. It opens full-screen like an app and keeps working when the signal drops."
          : "Tap the ⋮ menu in Chrome, then “Add to Home screen” (or “Install app”). It opens full-screen like an app and keeps working when the signal drops."}
      </p>
    </div>
  );
}
