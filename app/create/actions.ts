"use server";

import { headers } from "next/headers";
import { createOrganizer, getOrganizerByEmail, type Organizer } from "@/lib/organizers";
import { createEvent } from "@/lib/events";
import { parseEventForm } from "@/lib/event-input";
import { normalizeEmail, normalizeUsPhone, cleanText, type FieldErrors } from "@/lib/validation";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/admin/action-state";

function autoHandle(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  return base || "host";
}

/**
 * Public "create event" — no login wall. Builds the event AND the host account in
 * one shot: validates the event, then name/email/phone; reuses an existing host by
 * email or creates one (handle auto-generated), and saves the event as a DRAFT.
 * The client then hands off to the sign-in link so they publish + connect payouts.
 */
export async function createEventGuestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`create-event:${clientIpFrom(h)}`, { limit: 6, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  const { values, fieldErrors } = parseEventForm(formData);

  const hostName = cleanText(String(formData.get("host_name") ?? ""), 120);
  const email = normalizeEmail(String(formData.get("host_email") ?? ""));
  const phone = normalizeUsPhone(String(formData.get("host_phone") ?? ""));
  if (!hostName) fieldErrors.host_name = "Your name or crew name.";
  if (!email) fieldErrors.host_email = "A working email — this is your login.";
  if (!phone) fieldErrors.host_phone = "US mobile, e.g. (602) 555-0142.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  // Reuse an existing host by email, else create one with a unique auto handle.
  let organizer: Organizer | null = await getOrganizerByEmail(email!);
  if (!organizer) {
    const base = autoHandle(hostName);
    for (let i = 0; i < 12 && !organizer; i++) {
      try {
        organizer = await createOrganizer({
          name: hostName,
          handle: i === 0 ? base : `${base}${i + 1}`,
          email: email!,
          phone: phone!,
          instagram_handle: null,
        });
      } catch (err) {
        if ((err as Error).message === "HANDLE_TAKEN") continue;
        console.error("guest create organizer error", err);
        return { status: "error", message: "Couldn’t set up your account. Try again." };
      }
    }
    if (!organizer) return { status: "error", message: "Couldn’t set up your account. Try again." };
  }

  // Save the event as a draft (unique slug).
  const baseSlug = values.slug!;
  for (let i = 0; i < 8; i++) {
    try {
      await createEvent({
        organizer_id: organizer.id,
        title: values.title!,
        slug: i === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`,
        description: values.description ?? null,
        venue_name: values.venue_name!,
        venue_address: values.venue_address!,
        venue_zip: values.venue_zip ?? null,
        city: values.city!,
        state: values.state!,
        starts_at: values.starts_at!,
        status: "draft",
        capacity: values.capacity ?? null,
        event_type: values.event_type as never,
        community: values.community as never,
        primary_language: values.primary_language as never,
        genre: values.genre as never,
        talent: values.talent ?? [],
        is_first_event: false,
        tiers: values.tiers!,
      });
      return { status: "success" };
    } catch (err) {
      if ((err as Error).message === "SLUG_TAKEN") continue;
      console.error("guest create event error", err);
      return { status: "error", message: "Couldn’t save the event. Try again." };
    }
  }
  return { status: "error", message: "Couldn’t save the event. Try again." };
}
