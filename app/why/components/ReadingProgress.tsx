"use client";

import { useEffect, useState } from "react";

/** Sticky hairline progress bar — the only moving thing on the page. */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-gold transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
