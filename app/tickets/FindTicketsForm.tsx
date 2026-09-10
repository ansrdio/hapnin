"use client";

import { useState } from "react";

// Posts to /api/find-tickets. The server always answers the same way, so this
// form can only ever say "if we have them, they're on the way" — by design.
export function FindTicketsForm() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "invalid" | "limited" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setState("busy");
    try {
      const res = await fetch("/api/find-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (res.status === 429) setState("limited");
      else if (res.status === 400) setState("invalid");
      else if (res.ok) setState("sent");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-emerald/40 bg-emerald/10 px-5 py-4">
        <p className="font-display font-semibold text-cream">On its way.</p>
        <p className="mt-1 text-sm text-mauve-dim">
          If we have tickets for that, they&rsquo;re in your inbox within a minute — check spam too. Nothing
          arrived? You may have bought with a different email or number.
        </p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setQ("");
          }}
          className="mt-3 text-sm text-gold hover:underline"
        >
          Try another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="find-q" className="block text-xs font-medium uppercase tracking-[0.14em] text-gold">
        Email or mobile number
      </label>
      <input
        id="find-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="you@email.com or (602) 555-0142"
        autoComplete="email"
        inputMode="email"
        required
        className="w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="w-full rounded-xl bg-gold px-6 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
      >
        {state === "busy" ? "Sending…" : "Email my tickets"}
      </button>
      {state === "invalid" && <p className="text-sm text-coral">Enter the email or US mobile number you bought with.</p>}
      {state === "limited" && <p className="text-sm text-coral">Too many tries — give it a few minutes.</p>}
      {state === "error" && <p className="text-sm text-coral">Something went wrong. Try again.</p>}
    </form>
  );
}
