"use client";

import { useActionState, useEffect, useRef } from "react";
import { createOrganizerAction } from "./actions";
import { initialActionState } from "./action-state";

const field = "w-full rounded-xl border border-plum-hi bg-ink/40 px-4 py-3 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";

export function CreateOrganizerForm() {
  const [state, action] = useActionState(createOrganizerAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  const err = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
      <h2 className="font-display text-lg font-semibold text-cream">Create organizer</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="o-name">Name</label>
          <input id="o-name" name="name" className={field} placeholder="Aura Collective" />
          {err.name && <p className="mt-1 text-sm text-coral">{err.name}</p>}
        </div>
        <div>
          <label className={label} htmlFor="o-handle">Handle</label>
          <input id="o-handle" name="handle" className={field} placeholder="aura" />
          {err.handle && <p className="mt-1 text-sm text-coral">{err.handle}</p>}
        </div>
        <div>
          <label className={label} htmlFor="o-email">Email (their login)</label>
          <input id="o-email" name="email" type="email" className={field} placeholder="hi@auracollective.com" />
          {err.email && <p className="mt-1 text-sm text-coral">{err.email}</p>}
        </div>
        <div>
          <label className={label} htmlFor="o-phone">Phone</label>
          <input id="o-phone" name="phone" type="tel" className={field} placeholder="(602) 555-0142" />
          {err.phone && <p className="mt-1 text-sm text-coral">{err.phone}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="o-ig">Instagram <span className="normal-case tracking-normal text-mauve-dim">(optional)</span></label>
          <input id="o-ig" name="instagram" className={field} placeholder="auracollective" />
          {err.instagram && <p className="mt-1 text-sm text-coral">{err.instagram}</p>}
        </div>
      </div>
      <button className="mt-5 rounded-xl bg-gold px-6 py-3 font-display font-semibold text-ink transition-colors hover:bg-gold-hi">
        Create organizer
      </button>
      {state.status === "success" && state.message && <p className="mt-3 text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="mt-3 text-sm text-coral">{state.message}</p>}
    </form>
  );
}
