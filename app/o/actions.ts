"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer, requireOwner, requireScanAccess } from "@/lib/auth";
import { addTeamMember, removeTeamMember } from "@/lib/team";
import { getOrderById, checkInOrder } from "@/lib/orders";
import { refundOrder } from "@/lib/refunds";
import { sendSMS } from "@/lib/sms";
import { createEvent, getEventById, setEventStatus, setEventFlyer } from "@/lib/events";
import { parseEventForm } from "@/lib/event-input";
import { issueComp } from "@/lib/comps";
import { sendBroadcast, BROADCAST_MAX_LEN } from "@/lib/broadcasts";
import { isOneOf, EVENT_STATUS, TEAM_ROLE } from "@/lib/enums";
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

/** Text the event's opted-in audience. */
export async function broadcastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const body = cleanText(String(formData.get("body") ?? ""), BROADCAST_MAX_LEN);

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return { status: "error", message: "Event not found." };
  if (body.length < 3) return { status: "error", fieldErrors: { body: "Write a message first." } };

  try {
    const { recipients, sent, failed } = await sendBroadcast({ eventId, organizerId: organizer.id, body });
    if (recipients === 0) return { status: "error", message: "No opted-in buyers yet — nothing to send." };
    revalidatePath(`/o/events/${eventId}`);
    return {
      status: "success",
      message: `Sent to ${sent} of ${recipients}${failed ? ` (${failed} failed)` : ""}.`,
    };
  } catch (err) {
    console.error("broadcast error", err);
    return { status: "error", message: "Couldn’t send the broadcast. Try again." };
  }
}

// ── Guest list: manual check-in, resend, refund ──────────────────────────────

async function ownedEvent(eventId: string, organizerId: string) {
  const event = await getEventById(eventId);
  return event && event.organizer_id === organizerId ? event : null;
}

/** Manually check in a whole order at the door (owner/manager/door). */
export async function checkInOrderAction(formData: FormData): Promise<void> {
  const { organizer } = await requireScanAccess();
  const eventId = String(formData.get("event_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  if (!(await ownedEvent(eventId, organizer.id))) return;
  const order = await getOrderById(orderId);
  if (!order || order.event_id !== eventId) return;
  await checkInOrder(eventId, orderId, organizer.id);
  revalidatePath(`/o/events/${eventId}/guests`);
}

/** Re-text a guest their ticket link (owner/manager/door). */
export async function resendTicketAction(formData: FormData): Promise<void> {
  const { organizer } = await requireScanAccess();
  const eventId = String(formData.get("event_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const event = await ownedEvent(eventId, organizer.id);
  if (!event) return;
  const order = await getOrderById(orderId);
  if (!order || order.event_id !== eventId) return;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  await sendSMS({ to: order.buyer_id, body: `Your ticket for ${event.title}: ${site}/t/${orderId}` });
}

/** Refund an order (owner/manager, not door). */
export async function refundOrderAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  if (!(await ownedEvent(eventId, organizer.id))) return;
  try {
    await refundOrder(eventId, orderId);
  } catch (err) {
    console.error("refund error", err);
  }
  revalidatePath(`/o/events/${eventId}/guests`);
  revalidatePath(`/o/events/${eventId}`);
  revalidatePath("/o");
}

/** Add a team member (manager or door). Owner only. */
export async function addTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOwner();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = cleanText(String(formData.get("name") ?? ""), 80) || null;
  const role = String(formData.get("role") ?? "");

  const fieldErrors: FieldErrors = {};
  if (!email) fieldErrors.email = "A working email — this is their login.";
  if (!isOneOf(TEAM_ROLE, role)) fieldErrors.role = "Pick a role.";
  if (email && email === organizer.email) fieldErrors.email = "That’s you — you already own this account.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  await addTeamMember({ organizerId: organizer.id, email: email!, name, role: role as never });
  revalidatePath("/o/team");
  return { status: "success", message: `${name || email} added as ${role}.` };
}

/** Remove a team member. Owner only. */
export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOwner();
  const email = String(formData.get("email") ?? "");
  if (!email) return;
  await removeTeamMember(organizer.id, email);
  revalidatePath("/o/team");
}
