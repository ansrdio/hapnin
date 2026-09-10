"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { followOrganizerAction } from "@/app/actions/follow";
import { initialActionState } from "@/app/admin/action-state";

// "Get updates from X" — the buyer-side way into an organizer's audience.
// Their own consent, so it needs no attestation and can unlock texting later.

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="shrink-0 rounded-xl bg-gold px-5 py-3 font-display font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
    >
      {pending ? "Adding…" : "Get updates"}
    </button>
  );
}

export function FollowForm({ organizerId, organizerName, compact = false }: { organizerId: string; organizerName: string; compact?: boolean }) {
  const [state, action] = useActionState(followOrganizerAction, initialActionState);
  const err = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-2xl border border-emerald/40 bg-emerald/10 px-5 py-4 text-sm text-emerald">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={`rounded-2xl border border-white/10 bg-white/[0.03] ${compact ? "p-4" : "p-5"}`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <p className="font-display font-semibold text-cream">Hear about {organizerName}&rsquo;s next one first.</p>
      <p className="mt-0.5 text-sm text-mauve-dim">New events straight to your inbox. One click to unsubscribe.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          className="w-full rounded-xl border border-white/15 bg-ink/60 px-4 py-3 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
        />
        <Submit />
      </div>
      {err.email && <p className="mt-2 text-sm text-coral">{err.email}</p>}
      {state.status === "error" && state.message && <p className="mt-2 text-sm text-coral">{state.message}</p>}
    </form>
  );
}
