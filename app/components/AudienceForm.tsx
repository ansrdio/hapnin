"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitAudience, initialState } from "@/app/actions/signup";
import { SubmitButton } from "./SubmitButton";

export function AudienceForm() {
  const [state, formAction] = useActionState(submitAudience, initialState);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status !== "idle") liveRef.current?.focus();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald/40 bg-emerald/10 p-6"
        role="status"
      >
        <p
          ref={liveRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold text-cream outline-none"
        >
          {state.message}
        </p>
        <p className="mt-1 text-sm text-mauve-dim">
          No spam. Just the events worth leaving the house for.
        </p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="w-full">
      {/* Honeypot — hidden from humans and assistive tech, catnip for bots */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label
            htmlFor="phone"
            className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold"
          >
            Mobile number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(602) 555-0142"
            aria-invalid={!!err.phone}
            aria-describedby={err.phone ? "phone-err" : undefined}
            className="w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
          />
          {err.phone && (
            <p id="phone-err" className="mt-1.5 text-sm text-coral">
              {err.phone}
            </p>
          )}
        </div>

        <div className="sm:w-36">
          <label
            htmlFor="zip"
            className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold"
          >
            ZIP
          </label>
          <input
            id="zip"
            name="zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            placeholder="85004"
            aria-invalid={!!err.zip}
            aria-describedby={err.zip ? "zip-err" : undefined}
            className="w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
          />
          {err.zip && (
            <p id="zip-err" className="mt-1.5 text-sm text-coral">
              {err.zip}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <SubmitButton pendingLabel="One sec…">Tell me what&rsquo;s hapnin</SubmitButton>
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

      <p className="mt-3 text-sm text-mauve-dim">Phoenix first. Then wherever you are.</p>
    </form>
  );
}
