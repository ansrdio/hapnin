"use client";

import { useEffect, useState } from "react";

// Poll the order-status endpoint until the webhook has created the order, then
// jump to the ticket page. Falls back to a "check your texts" message.
export function ConfirmationPoller({ pi }: { pi: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pi) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      tries += 1;
      try {
        const res = await fetch(`/api/order-status?pi=${encodeURIComponent(pi)}`);
        const data = await res.json();
        if (data.ready && data.orderId) {
          window.location.href = `/t/${data.orderId}`;
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 20) {
        setSlow(true);
        return;
      }
      if (tries === 5) setSlow(true);
      setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [pi]);

  if (slow) {
    return (
      <p className="mt-6 text-sm text-mauve-dim">
        Taking a moment — we’ve also texted your ticket link to your phone.
      </p>
    );
  }
  return null;
}
