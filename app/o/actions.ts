"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizer, requireOwner, requireScanAccess } from "@/lib/auth";
import { createOnboardingLink, refreshOnboardingStatus } from "@/lib/connect";
import { addTeamMember, removeTeamMember } from "@/lib/team";
import { getOrderById, checkInOrder } from "@/lib/orders";
import { createPromoterLink } from "@/lib/promoters";
import { createPromoCode, normalizeCode } from "@/lib/promos";
import { sellAtDoor } from "@/lib/boxoffice";
import { notifyWaitlist } from "@/lib/waitlist";
import { refundOrder } from "@/lib/refunds";
import { sendSMS } from "@/lib/sms";
import { createEvent, getEventById, setEventStatus, setEventFlyer, createTable, updateEventDetails, updateTier, addTierToEvent, deleteEvent, isRefundPolicy } from "@/lib/events";
import { updateOrganizerProfile } from "@/lib/organizers";
import { parsePhoenixLocal } from "@/lib/event-input";
import { deliverTicket } from "@/lib/checkout";
import { getTiers } from "@/lib/events";
import { slugify } from "@/lib/event-input";
import { createExpressLoginLink } from "@/lib/connect";
import { parseContacts, importContacts, announceEvent, deleteContact, IMPORT_MAX_ROWS, ANNOUNCE_MAX_RECIPIENTS } from "@/lib/contacts";
import { setReviewHidden } from "@/lib/reviews";
import { createSeries, type Cadence } from "@/lib/series";
import { createSampleEvent, deleteSampleEvent } from "@/lib/sample";
import { parseEventForm } from "@/lib/event-input";
import { issueComp } from "@/lib/comps";
import { sendBroadcast, BROADCAST_MAX_LEN } from "@/lib/broadcasts";
import { isOneOf, EVENT_STATUS, TEAM_ROLE, EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { normalizeUsPhone, normalizeEmail, normalizeInstagram, normalizeZip, cleanText, type FieldErrors } from "@/lib/validation";
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
      venue_zip: values.venue_zip ?? null,
      city: values.city!,
      state: values.state!,
      starts_at: values.starts_at!,
      status,
      capacity: values.capacity ?? null,
      refund_policy: values.refund_policy as never,
      referral_off_cents: values.referral_off_cents ?? 0,
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
  if (event.is_sample && status !== "draft") return; // a sample never goes on sale

  await setEventStatus(eventId, status);
  revalidatePath(`/o/events/${eventId}`);
  revalidatePath("/o");
}

/** Seed (or jump to) the organizer's sample event — a demo night with made-up guests. */
export async function createSampleEventAction(): Promise<void> {
  const { organizer } = await requireOrganizer();
  const { id } = await createSampleEvent({ organizerId: organizer.id, handle: organizer.handle });
  revalidatePath("/o");
  redirect(`/o/events/${id}`);
}

/** Remove the sample event and every seeded guest, order and ticket with it. */
export async function deleteSampleEventAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const ok = await deleteSampleEvent(eventId, organizer.id);
  revalidatePath("/o");
  if (ok) redirect("/o?sample=deleted");
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
  // Keep line breaks — they matter in an email. HTML is escaped at render time.
  const body = String(formData.get("body") ?? "").replace(/\r/g, "").trim().slice(0, BROADCAST_MAX_LEN);
  const subject = cleanText(String(formData.get("subject") ?? ""), 120) || null;

  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) return { status: "error", message: "Event not found." };
  if (body.length < 3) return { status: "error", fieldErrors: { body: "Write a message first." } };

  try {
    const r = await sendBroadcast({ eventId, organizerId: organizer.id, body, subject });
    if (r.recipients === 0) return { status: "error", message: "No opted-in buyers yet — nothing to send." };
    revalidatePath(`/o/events/${eventId}`);
    const emailPart = `Emailed ${r.email.sent}${r.email.failed ? ` (${r.email.failed} failed)` : ""}`;
    const smsPart = r.sms.skipped
      ? ` · ${r.sms.skipped} text${r.sms.skipped === 1 ? "" : "s"} skipped (texting isn’t on yet)`
      : r.sms.sent || r.sms.failed
        ? ` · texted ${r.sms.sent}${r.sms.failed ? ` (${r.sms.failed} failed)` : ""}`
        : "";
    return { status: "success", message: `${emailPart}${smsPart}.` };
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
  // Email (when we have one) + best-effort SMS — Resend must work before Twilio lands.
  await deliverTicket({ orderId, quantity: order.quantity ?? 1, phone: order.buyer_id, event });
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

/** Record a box-office (cash/external-card) door sale. Owner/manager/door. */
export async function doorSellAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireScanAccess();
  const eventId = String(formData.get("event_id") ?? "");
  const tierId = String(formData.get("tier_id") ?? "");
  const quantity = parseInt(String(formData.get("quantity") ?? "1"), 10) || 1;
  const payment = String(formData.get("payment") ?? "cash");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizeUsPhone(phoneRaw) : null;
  const first_name = cleanText(String(formData.get("first_name") ?? ""), 80) || null;

  if (!(await ownedEvent(eventId, organizer.id))) return { status: "error", message: "Event not found." };
  const fieldErrors: FieldErrors = {};
  if (!tierId) fieldErrors.tier_id = "Pick a tier.";
  if (payment !== "cash" && payment !== "card") fieldErrors.payment = "Pick how they paid.";
  if (phoneRaw && !phone) fieldErrors.phone = "That number looks off.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    const { orderId } = await sellAtDoor({
      eventId,
      tierId,
      quantity,
      payment: payment as "cash" | "card",
      buyer: { phone, first_name },
      byId: organizer.id,
    });
    revalidatePath(`/o/events/${eventId}`);
    return { status: "success", message: `Sold ${quantity}. ${phone ? "Texted the ticket." : `hapnin.now/t/${orderId}`}` };
  } catch (err) {
    const m = (err as Error).message;
    if (m === "SOLD_OUT") return { status: "error", fieldErrors: { tier_id: "Not enough left in that tier." } };
    console.error("doorSell error", err);
    return { status: "error", message: "Couldn’t record the sale. Try again." };
  }
}

/** Create a promoter link for an event the organizer owns. */
export async function createPromoterLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const name = cleanText(String(formData.get("name") ?? ""), 60);
  const commissionRaw = String(formData.get("commission") ?? "").trim();
  const commissionCents = commissionRaw ? Math.max(0, Math.round(parseFloat(commissionRaw) * 100)) : 0;

  if (!(await ownedEvent(eventId, organizer.id))) return { status: "error", message: "Event not found." };
  if (!name) return { status: "error", fieldErrors: { name: "Give the promoter a name." } };

  try {
    await createPromoterLink({ eventId, organizerId: organizer.id, name, commissionCents });
    revalidatePath(`/o/events/${eventId}`);
    return { status: "success", message: `Link created for ${name}.` };
  } catch (err) {
    console.error("createPromoterLink error", err);
    return { status: "error", message: "Couldn’t create the link. Try again." };
  }
}

/** Text the event's waitlist that tickets are available. Owner/manager. */
export async function notifyWaitlistAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  if (!(await ownedEvent(eventId, organizer.id))) return;
  try {
    await notifyWaitlist(eventId);
  } catch (err) {
    console.error("notifyWaitlist error", err);
  }
  revalidatePath(`/o/events/${eventId}`);
}

/** Edit an event's details + GA tiers (add new / update existing). */
export async function editEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const event = await ownedEvent(eventId, organizer.id);
  if (!event) return { status: "error", message: "Event not found." };

  const title = cleanText(String(formData.get("title") ?? ""), 160);
  const venue_name = cleanText(String(formData.get("venue_name") ?? ""), 160);
  const venue_address = cleanText(String(formData.get("venue_address") ?? ""), 240);
  const venue_zip = normalizeZip(String(formData.get("venue_zip") ?? ""));
  const city = cleanText(String(formData.get("city") ?? ""), 80);
  const state = cleanText(String(formData.get("state") ?? ""), 40);
  const starts_at = parsePhoenixLocal(String(formData.get("starts_at") ?? ""));
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw ? parseInt(capRaw, 10) : null;
  const refundRaw = String(formData.get("refund_policy") ?? "none");
  const refund_policy = isRefundPolicy(refundRaw) ? refundRaw : "none";
  const referralDollars = parseFloat(String(formData.get("referral_off") ?? "0"));
  const referral_off_cents = Number.isFinite(referralDollars) ? Math.max(0, Math.min(5000, Math.round(referralDollars * 100))) : 0;
  const description = cleanText(String(formData.get("description") ?? ""), 2000) || null;
  const talent = String(formData.get("talent") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const event_type = String(formData.get("event_type") ?? "");
  const community = String(formData.get("community") ?? "");
  const primary_language = String(formData.get("primary_language") ?? "");
  const genre = String(formData.get("genre") ?? "");

  const fieldErrors: FieldErrors = {};
  if (!title) fieldErrors.title = "Required.";
  if (!venue_name) fieldErrors.venue_name = "Required.";
  if (!venue_address) fieldErrors.venue_address = "Required.";
  if (!city) fieldErrors.city = "Required.";
  if (!state) fieldErrors.state = "Required.";
  if (!starts_at) fieldErrors.starts_at = "Pick a date and time.";
  if (!isOneOf(EVENT_TYPE, event_type)) fieldErrors.event_type = "Pick one.";
  if (!isOneOf(COMMUNITY, community)) fieldErrors.community = "Pick one.";
  if (!isOneOf(LANGUAGE_CODE, primary_language)) fieldErrors.primary_language = "Pick one.";
  if (!isOneOf(GENRE, genre)) fieldErrors.genre = "Pick one.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  await updateEventDetails(eventId, {
    title, description, venue_name, venue_address, venue_zip, city, state,
    starts_at: starts_at!, capacity, refund_policy, referral_off_cents,
    event_type: event_type as never, community: community as never,
    primary_language: primary_language as never, genre: genre as never, talent,
  });

  // GA tiers — arrays are index-aligned (every row emits all fields incl. hidden id + active).
  const ids = formData.getAll("tier_id").map(String);
  const names = formData.getAll("tier_name").map(String);
  const prices = formData.getAll("tier_price").map(String);
  const qtys = formData.getAll("tier_qty").map(String);
  const actives = formData.getAll("tier_active").map(String);
  for (let i = 0; i < names.length; i++) {
    const name = cleanText(names[i], 80);
    const price_cents = Math.round(parseFloat(prices[i] || "0") * 100);
    const quantity_total = parseInt(qtys[i] || "0", 10);
    if (!name || quantity_total <= 0) continue;
    if (ids[i]) await updateTier(eventId, ids[i], { name, price_cents, quantity_total, is_active: actives[i] === "1" });
    else await addTierToEvent(eventId, { name, price_cents, quantity_total });
  }

  revalidatePath(`/o/events/${eventId}`);
  revalidatePath(`/o/events/${eventId}/edit`);
  revalidatePath(`/e/${event.slug}`);
  return { status: "success", message: "Saved." };
}

/** Delete an event the organizer owns — only if nothing has sold. */
export async function deleteEventAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const event = await ownedEvent(eventId, organizer.id);
  if (!event || event.tickets_sold > 0) return; // safety: never delete an event with sales
  await deleteEvent(eventId);
  revalidatePath("/o");
  redirect("/o");
}

/** Update the organizer's public profile. Owner only. */
export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOwner();
  const name = cleanText(String(formData.get("name") ?? ""), 120);
  const bio = cleanText(String(formData.get("bio") ?? ""), 500) || null;
  const instagram = normalizeInstagram(String(formData.get("instagram") ?? ""));
  const avatarRaw = String(formData.get("avatar_url") ?? "").trim();
  const avatar_url = /^https:\/\/\S{1,600}$/.test(avatarRaw) ? avatarRaw : null;

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Required.";
  if (instagram === null) fieldErrors.instagram = "Handle only, e.g. auracollective.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  await updateOrganizerProfile(organizer.id, {
    name,
    bio,
    instagram_handle: instagram ?? null,
    avatar_url,
  });
  revalidatePath("/o/profile");
  revalidatePath(`/o/${organizer.handle}`);
  return { status: "success", message: "Profile updated." };
}

/** Add a reserved table / bottle-service booth to an event the organizer owns. */
export async function createTableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const name = cleanText(String(formData.get("name") ?? ""), 60);
  const seats = parseInt(String(formData.get("seats") ?? "0"), 10) || 0;
  const priceRaw = parseFloat(String(formData.get("price") ?? "0")) || 0;

  if (!(await ownedEvent(eventId, organizer.id))) return { status: "error", message: "Event not found." };
  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Name the table.";
  if (seats < 1) fieldErrors.seats = "How many guests?";
  if (priceRaw <= 0) fieldErrors.price = "Set a price.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    await createTable(eventId, { name, seats, price_cents: Math.round(priceRaw * 100) });
    revalidatePath(`/o/events/${eventId}`);
    return { status: "success", message: `${name} added.` };
  } catch (err) {
    console.error("createTable error", err);
    return { status: "error", message: "Couldn’t add the table." };
  }
}

/** Create a promo code for an event the organizer owns. */
export async function createPromoCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const kind = String(formData.get("kind") ?? "");
  const valueRaw = parseFloat(String(formData.get("value") ?? "0")) || 0;
  const maxRaw = String(formData.get("max_redemptions") ?? "").trim();
  const maxRedemptions = maxRaw ? Math.max(1, parseInt(maxRaw, 10)) : null;

  if (!(await ownedEvent(eventId, organizer.id))) return { status: "error", message: "Event not found." };

  const fieldErrors: FieldErrors = {};
  if (!code) fieldErrors.code = "Letters and numbers only.";
  if (kind !== "percent" && kind !== "amount") fieldErrors.kind = "Pick a type.";
  if (kind === "percent" && (valueRaw <= 0 || valueRaw > 100)) fieldErrors.value = "1–100%.";
  if (kind === "amount" && valueRaw <= 0) fieldErrors.value = "Enter an amount.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const value = kind === "percent" ? Math.round(valueRaw) : Math.round(valueRaw * 100);

  try {
    await createPromoCode({ eventId, organizerId: organizer.id, code, kind: kind as "percent" | "amount", value, maxRedemptions });
    revalidatePath(`/o/events/${eventId}`);
    return { status: "success", message: `Code ${code} created.` };
  } catch (err) {
    if ((err as Error).message === "CODE_TAKEN") return { status: "error", fieldErrors: { code: "That code exists." } };
    console.error("createPromoCode error", err);
    return { status: "error", message: "Couldn’t create the code." };
  }
}

/** Organizer connects their own Stripe payouts (self-serve). Owner only. */
export async function startOwnOnboardingAction(): Promise<void> {
  const { organizer } = await requireOwner();
  let url: string | null = null;
  try {
    url = await createOnboardingLink(organizer.id, "/o");
  } catch (err) {
    console.error("startOwnOnboarding error", err);
    const reason = (err as { code?: string }).code || (err as Error).message || "unknown";
    redirect(`/o?payout_error=${encodeURIComponent(String(reason).slice(0, 160))}`);
  }
  redirect(url!); // → Stripe-hosted Express onboarding, returns to /o
}

/** Pull the latest Stripe onboarding status after returning from Stripe. */
export async function refreshOwnStripeStatusAction(): Promise<void> {
  const { organizer } = await requireOwner();
  try {
    await refreshOnboardingStatus(organizer.id);
  } catch (err) {
    console.error("refreshOwnStripeStatus error", err);
  }
  revalidatePath("/o");
}

/**
 * Copy an event — details, flyer, refund policy, GA tiers (sale windows shifted),
 * tables — as a new DRAFT one week later, then open it for editing. Built for
 * the weekly night: one click instead of re-entering everything.
 */
export async function duplicateEventAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const source = await ownedEvent(eventId, organizer.id);
  if (!source) return;
  const tiers = await getTiers(eventId);

  // Next week from the source date, or from now if the source is already past.
  const WEEK = 7 * 86_400_000;
  const base = source.starts_at > Date.now() ? source.starts_at : Date.now();
  const delta = base + WEEK - source.starts_at;
  const shift = (ms: number | null) => (ms == null ? null : ms + delta);
  const stem = slugify(source.title) ?? "event";

  let created: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const slug = `${stem}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      created = await createEvent({
        organizer_id: organizer.id,
        title: source.title,
        slug,
        description: source.description,
        flyer_url: source.flyer_url,
        venue_name: source.venue_name,
        venue_address: source.venue_address,
        venue_zip: source.venue_zip,
        city: source.city,
        state: source.state,
        starts_at: source.starts_at + delta,
        doors_at: shift(source.doors_at),
        timezone: source.timezone,
        status: "draft",
        capacity: source.capacity,
        refund_policy: source.refund_policy,
        referral_off_cents: source.referral_off_cents,
        event_type: source.event_type,
        community: source.community,
        primary_language: source.primary_language,
        genre: source.genre,
        talent: source.talent,
        is_first_event: false,
        tiers: tiers
          .filter((t) => t.kind !== "table")
          .map((t) => ({
            name: t.name,
            price_cents: t.price_cents,
            quantity_total: t.quantity_total,
            sales_start_at: shift(t.sales_start_at),
            sales_end_at: shift(t.sales_end_at),
          })),
      });
    } catch (err) {
      if ((err as Error).message !== "SLUG_TAKEN") throw err; // else try another suffix
    }
  }
  if (!created) return;

  for (const t of tiers.filter((t) => t.kind === "table")) {
    await createTable(created.id, { name: t.name, seats: t.seats ?? 1, price_cents: t.price_cents });
  }

  revalidatePath("/o");
  redirect(`/o/events/${created.id}/edit?duplicated=1`);
}

/** Open the organizer's Stripe Express dashboard (balance, payouts). Owner only. */
export async function openStripeDashboardAction(): Promise<void> {
  const { organizer } = await requireOwner();
  let url: string | null = null;
  try {
    url = await createExpressLoginLink(organizer.id);
  } catch (err) {
    console.error("stripe login link error", err);
  }
  redirect(url ?? `/o?payout_error=${encodeURIComponent("Couldn’t open your Stripe dashboard — connect payouts first.")}`);
}

// ── Audience: imported contacts + announcements ──────────────────────────────

/** Import pasted emails / a CSV into the organizer's contacts. Requires the permission attestation. */
export async function importContactsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  if (formData.get("attest") !== "on") {
    return { status: "error", fieldErrors: { attest: "Confirm you have permission to contact these people." } };
  }
  const text = String(formData.get("text") ?? "");
  if (text.trim().length < 5) return { status: "error", fieldErrors: { text: "Paste emails or upload a CSV first." } };

  const { rows, skipped, truncated } = parseContacts(text);
  if (rows.length === 0) return { status: "error", fieldErrors: { text: "No email addresses found in that." } };

  try {
    const { added, updated } = await importContacts({ organizerId: organizer.id, rows, attestedBy: organizer.email });
    revalidatePath("/o/audience");
    return {
      status: "success",
      message:
        `Imported ${added} new` +
        (updated ? ` · ${updated} updated` : "") +
        (skipped ? ` · ${skipped} line${skipped === 1 ? "" : "s"} skipped (no email)` : "") +
        (truncated ? ` · capped at ${IMPORT_MAX_ROWS.toLocaleString()} per import` : "") +
        ".",
    };
  } catch (err) {
    console.error("importContacts error", err);
    return { status: "error", message: "Couldn’t import. Try again." };
  }
}

/** Email an event to the organizer's whole audience (contacts + opted-in buyers). */
export async function announceEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const subject = cleanText(String(formData.get("subject") ?? ""), 120);
  const body = String(formData.get("body") ?? "").replace(/\r/g, "").trim().slice(0, 2000);
  if (!(await ownedEvent(eventId, organizer.id))) return { status: "error", message: "Pick an event." };
  if (!subject) return { status: "error", fieldErrors: { subject: "Give it a subject." } };
  if (body.length < 3) return { status: "error", fieldErrors: { body: "Write a message first." } };

  try {
    const r = await announceEvent({ organizerId: organizer.id, eventId, subject, body });
    if (r.recipients === 0) return { status: "error", message: "Your audience is empty — import contacts first." };
    revalidatePath("/o/audience");
    return {
      status: "success",
      message:
        `Sent to ${r.sent} of ${r.recipients}` +
        (r.failed ? ` (${r.failed} failed)` : "") +
        (r.capped ? ` · list capped at ${ANNOUNCE_MAX_RECIPIENTS.toLocaleString()} per send` : "") +
        ".",
    };
  } catch (err) {
    console.error("announceEvent error", err);
    return { status: "error", message: "Couldn’t send the announcement. Try again." };
  }
}

/** Remove one imported contact. */
export async function deleteContactAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  await deleteContact(organizer.id, String(formData.get("contact_id") ?? ""));
  revalidatePath("/o/audience");
}

/** Recurring series: clone this event N times on a cadence (drafts, or published straight away). */
export async function createSeriesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const cadenceRaw = String(formData.get("cadence") ?? "weekly");
  const cadence: Cadence = cadenceRaw === "biweekly" || cadenceRaw === "monthly" ? cadenceRaw : "weekly";
  const count = Math.max(1, Math.min(12, parseInt(String(formData.get("count") ?? "4"), 10) || 4));
  const publish = formData.get("publish") === "on";
  const source = await ownedEvent(eventId, organizer.id);
  if (!source) return { status: "error", message: "Event not found." };
  if (publish && !organizer.stripe_onboarded) {
    const hasPaidTier = (await getTiers(source.id)).some((t) => t.price_cents > 0);
    if (hasPaidTier) return { status: "error", message: "Connect payouts before publishing a paid series — tickets can’t sell without it." };
  }
  try {
    const ids = await createSeries({ source, organizerId: organizer.id, cadence, count, publish });
    revalidatePath("/o");
    const label = cadence === "weekly" ? "weekly" : cadence === "biweekly" ? "every two weeks" : "monthly";
    return {
      status: "success",
      message: `Created ${ids.length} ${label} ${ids.length === 1 ? "event" : "events"} — ${publish ? "on sale now" : "as drafts, ready to publish"}. They’re on your Events page.`,
    };
  } catch (err) {
    console.error("createSeries error", err);
    return { status: "error", message: "Couldn’t create the series. Try again." };
  }
}

/** Hide or show one of the organizer's reviews on their public page. Never edits it. */
export async function setReviewHiddenAction(formData: FormData): Promise<void> {
  const { organizer } = await requireOrganizer();
  const reviewId = String(formData.get("review_id") ?? "");
  const hidden = String(formData.get("hidden") ?? "0") === "1";
  if (reviewId) await setReviewHidden(organizer.id, reviewId, hidden);
  revalidatePath("/o/reviews");
  revalidatePath(`/o/${organizer.handle}`);
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
