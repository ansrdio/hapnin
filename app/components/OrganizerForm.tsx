"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitOrganizer, initialState } from "@/app/actions/signup";
import { SubmitButton } from "./SubmitButton";

const fieldBase =
  "w-full rounded-xl border border-plum-hi bg-ink/40 px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const labelBase =
  "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";

export function OrganizerForm() {
  const [state, formAction] = useActionState(submitOrganizer, initialState);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status !== "idle") liveRef.current?.focus();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-6" role="status">
        <p
          ref={liveRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold text-cream outline-none"
        >
          {state.message}
        </p>
        <p className="mt-1 text-sm text-mauve-dim">
          We&rsquo;re starting in Phoenix — if you&rsquo;re elsewhere, you help us pick where next.
        </p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="w-full">
      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="org-name" className={labelBase}>
            Your name
          </label>
          <input
            id="org-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Okafor"
            aria-invalid={!!err.name}
            aria-describedby={err.name ? "name-err" : undefined}
            className={fieldBase}
          />
          {err.name && (
            <p id="name-err" className="mt-1.5 text-sm text-coral">
              {err.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="org-email" className={labelBase}>
            Email
          </label>
          <input
            id="org-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            aria-invalid={!!err.email}
            aria-describedby={err.email ? "email-err" : undefined}
            className={fieldBase}
          />
          {err.email && (
            <p id="email-err" className="mt-1.5 text-sm text-coral">
              {err.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="org-ig" className={labelBase}>
            Instagram
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mauve-dim">
              @
            </span>
            <input
              id="org-ig"
              name="instagram"
              type="text"
              autoComplete="off"
              placeholder="yourhandle"
              aria-invalid={!!err.instagram}
              aria-describedby={err.instagram ? "ig-err" : undefined}
              className={`${fieldBase} pl-8`}
            />
          </div>
          {err.instagram && (
            <p id="ig-err" className="mt-1.5 text-sm text-coral">
              {err.instagram}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="org-city" className={labelBase}>
            City
          </label>
          <input
            id="org-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="Phoenix, AZ"
            aria-invalid={!!err.city}
            aria-describedby={err.city ? "city-err" : undefined}
            className={fieldBase}
          />
          {err.city && (
            <p id="city-err" className="mt-1.5 text-sm text-coral">
              {err.city}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="org-note" className={labelBase}>
          What do you run? <span className="normal-case tracking-normal text-mauve-dim">(optional)</span>
        </label>
        <textarea
          id="org-note"
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Afrobeats nights, a monthly owambe, a film series…"
          className={`${fieldBase} resize-none`}
        />
      </div>

      <div className="mt-5">
        <SubmitButton pendingLabel="One sec…">Run your next event on Hapnin</SubmitButton>
      </div>

      {state.status === "error" && state.message && (
        <p
          ref={liveRef}
          tabIndex={-1}
          role="alert"
          className="mt-3 text-sm text-coral outline-none"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
