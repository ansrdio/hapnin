"use client";

import { useEffect, useState } from "react";

// "Early bird ends in 2d 4h" — ticks every minute. Renders nothing until
// mounted so server and client markup never disagree, and nothing once past.
function fmt(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function Countdown({ until, prefix = "Ends in", className }: { until: number; prefix?: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setText(until > Date.now() ? fmt(until - Date.now()) : null);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [until]);
  if (!text) return null;
  return (
    <p className={className ?? "mt-0.5 text-sm font-medium text-coral"}>
      {prefix} {text}
    </p>
  );
}
