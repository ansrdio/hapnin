"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createEvent, getEventById, setEventStatus, setEventFlyer } from "@/lib/events";
import { parseEventForm } from "@/lib/event-input";
import { issueComp } from "@/lib/comps";
import { isOneOf, EVENT_STATUS } from "@/lib/enums";
import { normalizeUsPhone, normalizeEmail, cleanText, type FieldErrors } from "@/lib/validation";
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

/** Issue comp (free) tickets to a guest for an event the organizer owns. */
export async function issueCompAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const tierId = String(formData.get("tier_id") ?? "");
  const quantity = parseInt(String(formData.get("quantity") ?? "1"), 10) || 1;
  const first_name = cleanText(String(formData.get("first_name") ?? ""), 80);
  const last_name = cleanText(String(formData.get("last_name") ?? ""), 80);
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? "")); // optional
  const note = cleanText(String(formData.get("note") ?? ""), 200) || null;

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return { status: "error", message: "Event not found." };

  const fieldErrors: FieldErrors = {};
  if (!tierId) fieldErrors.tier_id = "Pick a tier.";
  if (!first_name) fieldErrors.first_name = "Required.";
  if (!phone) fieldErrors.phone = "A US mobile — the pass texts here.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    const { orderId } = await issueComp({
      eventId,
      tierId,
      quantity,
      buyer: { phone: phone!, first_name, last_name, email },
      note,
    });
    revalidatePath(`/o/events/${eventId}`);
    revalidatePath("/o");
    return { status: "success", message: `Issued ${quantity} pass${quantity > 1 ? "es" : ""} to ${first_name}. hapnin.now/t/${orderId}` };
  } catch (err) {
    const m = (err as Error).message;
    if (m === "SOLD_OUT") return { status: "error", fieldErrors: { tier_id: "Not enough left in that tier." } };
    if (m === "TIER_NOT_FOUND") return { status: "error", fieldErrors: { tier_id: "Pick a valid tier." } };
    console.error("issueComp error", err);
    return { status: "error", message: "Couldn’t issue the comp. Try again." };
  }
}
