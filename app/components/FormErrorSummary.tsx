"use client";

import { useEffect } from "react";

// On a long form the Save button sits far below the first invalid field, so a
// rejected submit looked like nothing happened. This puts the list of what to
// fix right above the button and scrolls the first bad field into view.
// Field-level messages carry data-field-error (see ui.tsx Field and
// ClassificationFields); that's how the first one is found.

export function FormErrorSummary({
  status,
  errors,
  labels,
  message,
}: {
  status: string;
  errors: Record<string, string | undefined>;
  labels: Record<string, string>;
  message?: string;
}) {
  const keys = Object.keys(errors).filter((k) => errors[k]);

  useEffect(() => {
    if (status !== "error") return;
    const first = document.querySelector<HTMLElement>("[data-field-error]");
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      const control = first.parentElement?.querySelector<HTMLElement>("input, select, textarea");
      control?.focus({ preventScroll: true });
    }
  }, [status, keys.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== "error") return null;
  if (keys.length === 0 && !message) return null;
  return (
    <div role="alert" className="rounded-xl border border-coral/50 bg-coral/10 px-4 py-3 text-sm text-cream">
      {keys.length > 0 ? (
        <>
          <p className="font-semibold text-coral">Not saved yet — fix these first:</p>
          <ul className="mt-1 list-disc pl-5">
            {keys.map((k) => (
              <li key={k}>
                <span className="font-medium">{labels[k] ?? k}</span>
                {errors[k] ? <span className="text-mauve-dim"> — {errors[k]}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}

export const EVENT_FIELD_LABELS: Record<string, string> = {
  title: "Event title",
  slug: "Event link",
  starts_at: "Date & time",
  venue_name: "Venue name",
  venue_address: "Venue address",
  city: "City",
  state: "State",
  category: "Category",
  scene_tags: "Scene & culture",
  custom_tags: "Your own tags",
  primary_language: "Language",
  tiers: "Ticket tiers",
  host_name: "Name or crew",
  host_email: "Email",
  host_phone: "Mobile",
  capacity: "Capacity",
  referral_off: "Bring-a-friend discount",
};
