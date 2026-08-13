"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlistAction } from "./actions";
import { initialActionState } from "@/app/admin/action-state";

const field = "w-full rounded-xl border border-plum-hi bg-plum px-4 py-3 text-cream placeholder:text-mauve-dim/60 focus:border-gold";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded-xl bg-gold px-6 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
    >
      {pending ? "Adding…" : "Join the waitlist"}
    </button>
  );
}

export function WaitlistForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(joinWaitlistAction, initialActionState);
  const [open, setOpen] = useState(false);
  const err = state.fieldErrors ?? {};

  if (state.status === "success") {
    return <p className="mt-6 rounded-2xl border border-emerald/40 bg-emerald/10 p-4 text-center text-sm text-emerald">{state.message}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 w-full rounded-xl border border-plum-hi px-6 py-3.5 font-display font-semibold text-cream transition-colors hover:bg-plum"
      >
        Join the waitlist
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-3 rounded-2xl border border-plum-hi bg-plum/40 p-5">
      <p className="font-display font-semibold text-cream">Sold out — join the waitlist</p>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="quantity" value={1} />
      <input name="name" className={field} placeholder="Your name (optional)" />
      <input name="phone" type="tel" className={field} placeholder="Your mobile number" />
      {err.phone && <p className="text-sm text-coral">{err.phone}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit />
    </form>
  );
}
