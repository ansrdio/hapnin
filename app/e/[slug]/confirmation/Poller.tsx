"use client";

import { useEffect, useState } from "react";

// Poll the order-status endpoint until the webhook has created the order, then
// jump to the ticket page. Stripe's webhook can lag (cold start, retry), so we
// keep looking for ~3 minutes before offering a manual "check again" — and we
// never claim a delivery channel we can't guarantee.
const INTERVAL_MS = 1500;
const MAX_TRIES = 120; // ≈ 3 minutes
const SLOW_AFTER = 5; // ≈ 7.5s → show the "still confirming" note

export function ConfirmationPoller({ pi }: { pi: string }) {
  const [phase, setPhase] = useState<"polling" | "slow" | "gaveUp">("polling");
  const [round, setRound] = useState(0); // bump to restart polling

  useEffect(() => {
    if (!pi) return;
    let tries = 0;
    let stop = false;
    setPhase("polling");
    const tick = async () => {
      if (stop) return;
      tries += 1;
      try {
        const res = await fetch(`/api/order-status?pi=${encodeURIComponent(pi)}`, { cache: "no-store" });
        const data = await res.json();
        if (data.ready && data.orderId) {
          window.location.href = `/t/${data.orderId}`;
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries >= MAX_TRIES) {
        setPhase("gaveUp");
        return;
      }
      if (tries === SLOW_AFTER) setPhase("slow");
      setTimeout(tick, INTERVAL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [pi, round]);

  if (phase === "slow") {
    return (
      <p className="mt-6 text-sm text-mauve-dim">
        Still confirming with Stripe — this usually takes a few seconds. Your payment went through;
        we&rsquo;ll also email your ticket link.
      </p>
    );
  }

  if (phase === "gaveUp") {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-mauve-dim">
          Your payment went through, but your ticket is taking longer than usual to appear.
          We&rsquo;ve emailed your ticket link — check your inbox (and spam). You can also check again here.
        </p>
        <button
          onClick={() => setRound((r) => r + 1)}
          className="rounded-xl border border-gold/50 px-5 py-2.5 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
        >
          Check again
        </button>
      </div>
    );
  }

  return null;
}
