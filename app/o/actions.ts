"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createEvent, getEventById, setEventStatus, setEventFlyer } from "@/lib/events";
import { parseEventForm } from "@/lib/event-input";
import { isOneOf, EVENT_STATUS } from "@/lib/enums";
import type { ActionState } from "@/app/admin/action-state";

/** Create an event owned by the signed-in organizer. "publish" → on_sale, else draft. */
export async function createOrganizerEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const { values, fieldErrors } = parseEventForm(formData);
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const status = formData.get("intent") === "publish" ? "on_sale" : "draft";

  let eventId: string;
  try {
    const event = await createEvent({
      organizer_id: organizer.id,
      title: values.title!,
      slug: values.slug!,
      description: values.description ?? null,
      flyer_url: values.flyer_url ?? null,
      venue_name: values.venue_name!,
      venue_address: values.venue_address!,
      city: values.city!,
      state: values.state!,
      starts_at: values.starts_at!,
      status,
      capacity: values.capacity ?? null,
      event_type: values.event_type as never,
      community: values.community as never,
      primary_language: values.primary_language as never,
      genre: values.genre as never,
      talent: values.talent ?? [],
      is_first_event: values.is_first_event ?? false,
      tiers: values.tiers!,
    });
    eventId = event.id;
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { slug: "That link is taken." } };
    console.error("createOrganizerEvent error", err);
    return { status: "error", message: "Couldn’t create the event. Try again." };
  }

  redirect(`/o/events/${eventId}`);
}

/** Publish / unpublish / cancel an event the organizer owns. */
export async function setEventStatusAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isOneOf(EVENT_STATUS, status)) return;

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return; // not theirs → no-op

  await setEventStatus(eventId, status);
  revalidatePath(`/o/events/${eventId}`);
  revalidatePath("/o");
}

/** Set or clear an event's flyer (from the manage page). */
export async function setEventFlyerAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const raw = String(formData.get("flyer_url") ?? "").trim();
  const flyerUrl = /^https:\/\/\S{1,600}$/.test(raw) ? raw : null;

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return; // not theirs → no-op

  await setEventFlyer(eventId, flyerUrl);
  revalidatePath(`/o/events/${eventId}`);
  revalidatePath("/o");
}
