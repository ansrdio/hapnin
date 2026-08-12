"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createOrganizer, getOrganizerById } from "@/lib/organizers";
import { createOnboardingLink, refreshOnboardingStatus } from "@/lib/connect";
import { sendSMS } from "@/lib/sms";
import { createEvent } from "@/lib/events";
import {
  EVENT_TYPE,
  COMMUNITY,
  LANGUAGE_CODE,
  GENRE,
  isOneOf,
} from "@/lib/enums";
import { normalizeEmail, normalizeUsPhone, normalizeInstagram, cleanText, type FieldErrors } from "@/lib/validation";
import type { ActionState } from "./action-state";

// America/Phoenix is UTC-7 year-round (no DST). Good enough for the launch city;
// generalize with a tz library when events span timezones (Phase 2).
function parsePhoenixLocal(dt: string): number | null {
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 7, +m[5]);
}

function slugify(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z0-9][a-z0-9-]{1,60}$/.test(s) ? s : null;
}

function normalizeHandle(raw: string): string | null {
  const h = (raw || "").trim().toLowerCase().replace(/^@+/, "");
  return /^[a-z0-9][a-z0-9._-]{1,30}$/.test(h) ? h : null;
}

export async function createOrganizerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const name = cleanText(String(formData.get("name") ?? ""), 120);
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const instagram = normalizeInstagram(String(formData.get("instagram") ?? ""));

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Required.";
  if (!handle) fieldErrors.handle = "Lowercase letters, numbers, . _ - (this is /o/{handle}).";
  if (!email) fieldErrors.email = "A working email — this is their login.";
  if (!phone) fieldErrors.phone = "US mobile, e.g. (602) 555-0142.";
  if (instagram === null) fieldErrors.instagram = "Handle only.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    await createOrganizer({ name, handle: handle!, email: email!, phone: phone!, instagram_handle: instagram ?? null });
  } catch (err) {
    if ((err as Error).message === "HANDLE_TAKEN") {
      return { status: "error", fieldErrors: { handle: "That handle is taken." } };
    }
    console.error("createOrganizer error", err);
    return { status: "error", message: "Couldn’t create the organizer. Try again." };
  }

  revalidatePath("/admin");
  return { status: "success", message: `${name} created.` };
}

export async function startOnboardingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("organizer_id") ?? "");
  if (!id) return;
  const url = await createOnboardingLink(id);
  redirect(url); // → Stripe-hosted Express onboarding
}

export async function refreshStripeStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("organizer_id") ?? "");
  if (!id) return;
  await refreshOnboardingStatus(id);
  revalidatePath(`/admin/organizers/${id}`);
}

export async function sendTestSmsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("organizer_id") ?? "");
  const organizer = await getOrganizerById(id);
  if (!organizer) return { status: "error", message: "Organizer not found." };
  const res = await sendSMS({ to: organizer.phone, body: `Hapnin test — ${organizer.name}, your account is wired up. 🎟️` });
  if (!res.ok) return { status: "error", message: `SMS failed: ${res.error}` };
  return { status: "success", message: res.mode === "twilio" ? "Sent via Twilio." : "Logged in dev mode (no Twilio creds yet)." };
}

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const organizerId = String(formData.get("organizer_id") ?? "");

  const title = cleanText(String(formData.get("title") ?? ""), 160);
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  const venue_name = cleanText(String(formData.get("venue_name") ?? ""), 160);
  const venue_address = cleanText(String(formData.get("venue_address") ?? ""), 240);
  const city = cleanText(String(formData.get("city") ?? ""), 80);
  const state = cleanText(String(formData.get("state") ?? ""), 40);
  const starts_at = parsePhoenixLocal(String(formData.get("starts_at") ?? ""));
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null;
  const description = cleanText(String(formData.get("description") ?? ""), 2000) || null;
  const talent = String(formData.get("talent") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const is_first_event = formData.get("is_first_event") === "on";

  const event_type = String(formData.get("event_type") ?? "");
  const community = String(formData.get("community") ?? "");
  const primary_language = String(formData.get("primary_language") ?? "");
  const genre = String(formData.get("genre") ?? "");

  const fieldErrors: FieldErrors = {};
  if (!title) fieldErrors.title = "Required.";
  if (!slug) fieldErrors.slug = "Letters, numbers, hyphens.";
  if (!venue_name) fieldErrors.venue_name = "Required.";
  if (!venue_address) fieldErrors.venue_address = "Required.";
  if (!city) fieldErrors.city = "Required.";
  if (!state) fieldErrors.state = "Required.";
  if (!starts_at) fieldErrors.starts_at = "Pick a date and time.";
  if (!isOneOf(EVENT_TYPE, event_type)) fieldErrors.event_type = "Pick one.";
  if (!isOneOf(COMMUNITY, community)) fieldErrors.community = "Pick one.";
  if (!isOneOf(LANGUAGE_CODE, primary_language)) fieldErrors.primary_language = "Pick one.";
  if (!isOneOf(GENRE, genre)) fieldErrors.genre = "Pick one.";

  const names = formData.getAll("tier_name").map(String);
  const prices = formData.getAll("tier_price").map(String);
  const qtys = formData.getAll("tier_qty").map(String);
  const tiers = names
    .map((name, i) => ({
      name: cleanText(name, 80),
      price_cents: Math.round(parseFloat(prices[i] || "0") * 100),
      quantity_total: parseInt(qtys[i] || "0", 10),
    }))
    .filter((t) => t.name && t.quantity_total > 0 && t.price_cents >= 0);
  if (tiers.length === 0) fieldErrors.tiers = "Add at least one tier with a name and quantity.";

  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    const event = await createEvent({
      organizer_id: organizerId,
      title, slug: slug!, description,
      venue_name, venue_address, city, state,
      starts_at: starts_at!,
      status: "on_sale",
      capacity,
      event_type: event_type as never,
      community: community as never,
      primary_language: primary_language as never,
      genre: genre as never,
      talent,
      is_first_event,
      tiers,
    });
    revalidatePath(`/admin/organizers/${organizerId}`);
    return { status: "success", message: `Event created — live at /e/${event.slug}` };
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { slug: "That slug is taken." } };
    console.error("createEvent error", err);
    return { status: "error", message: "Couldn’t create the event." };
  }
}
