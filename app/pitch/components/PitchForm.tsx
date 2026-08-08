"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitPitch, initialPitchState } from "@/app/actions/pitch";
import { SubmitButton } from "@/app/components/SubmitButton";

const fieldBase =
  "w-full rounded-xl border border-plum-hi bg-ink/40 px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const labelBase = "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";

export function PitchForm() {
  const [state, formAction] = useActionState(submitPitch, initialPitchState);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status !== "idle") liveRef.current?.focus();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-7" role="status">
        <p
          ref={liveRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold text-cream outline-none"
        >
          {state.message}
        </p>
        <p className="mt-2 text-mauve-dim">
          I&rsquo;ll reach out to set up your event — takes about twenty minutes of your time.
        </p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="w-full">
      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="p-website">Website</label>
        <input id="p-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className={labelBase}>
            Your name
          </label>
          <input
            id="p-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Okafor"
            aria-invalid={!!err.name}
            aria-describedby={err.name ? "p-name-err" : undefined}
            className={fieldBase}
          />
          {err.name && <FieldError id="p-name-err">{err.name}</FieldError>}
        </div>

        <div>
          <label htmlFor="p-ig" className={labelBase}>
            Instagram
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mauve-dim">
              @
            </span>
            <input
              id="p-ig"
              name="instagram"
              type="text"
              autoComplete="off"
              placeholder="yourhandle"
              aria-invalid={!!err.instagram}
              aria-describedby={err.instagram ? "p-ig-err" : undefined}
              className={`${fieldBase} pl-9`}
            />
          </div>
          {err.instagram && <FieldError id="p-ig-err">{err.instagram}</FieldError>}
        </div>

        <div>
          <label htmlFor="p-email" className={labelBase}>
            Email
          </label>
          <input
            id="p-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            aria-invalid={!!err.email}
            aria-describedby={err.email ? "p-email-err" : undefined}
            className={fieldBase}
          />
          {err.email && <FieldError id="p-email-err">{err.email}</FieldError>}
        </div>

        <div>
          <label htmlFor="p-phone" className={labelBase}>
            Phone
          </label>
          <input
            id="p-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(602) 555-0142"
            aria-invalid={!!err.phone}
            aria-describedby={err.phone ? "p-phone-err" : undefined}
            className={fieldBase}
          />
          {err.phone && <FieldError id="p-phone-err">{err.phone}</FieldError>}
        </div>

        <div>
          <label htmlFor="p-event" className={labelBase}>
            Event name <span className="normal-case tracking-normal text-mauve-dim">(optional)</span>
          </label>
          <input
            id="p-event"
            name="event_name"
            type="text"
            autoComplete="off"
            placeholder="Owambe Season, Lagos Nights…"
            className={fieldBase}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="p-date" className={labelBase}>
              Date <span className="normal-case tracking-normal text-mauve-dim">(opt.)</span>
            </label>
            <input
              id="p-date"
              name="event_date"
              type="date"
              aria-invalid={!!err.event_date}
              aria-describedby={err.event_date ? "p-date-err" : undefined}
              className={`${fieldBase} [color-scheme:dark]`}
            />
            {err.event_date && <FieldError id="p-date-err">{err.event_date}</FieldError>}
          </div>
          <div>
            <label htmlFor="p-att" className={labelBase}>
              Attendance <span className="normal-case tracking-normal text-mauve-dim">(opt.)</span>
            </label>
            <input
              id="p-att"
              name="expected_attendance"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="150"
              aria-invalid={!!err.expected_attendance}
              aria-describedby={err.expected_attendance ? "p-att-err" : undefined}
              className={fieldBase}
            />
            {err.expected_attendance && (
              <FieldError id="p-att-err">{err.expected_attendance}</FieldError>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="p-note" className={labelBase}>
          Anything else <span className="normal-case tracking-normal text-mauve-dim">(optional)</span>
        </label>
        <textarea
          id="p-note"
          name="note"
          rows={3}
          maxLength={800}
          placeholder="Venue, how you usually sell tickets, what you'd want on day one…"
          className={`${fieldBase} resize-none`}
        />
      </div>

      <div className="mt-6">
        <SubmitButton pendingLabel="Sending…">Send it over</SubmitButton>
      </div>

      {state.status === "error" && state.message && (
        <p ref={liveRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-coral outline-none">
          {state.message}
        </p>
      )}
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-coral">
      {children}
    </p>
  );
}
