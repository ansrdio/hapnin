"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createOrganizer, getOrganizerById } from "@/lib/organizers";
import { createOnboardingLink, refreshOnboardingStatus } from "@/lib/connect";
import { sendSMS } from "@/lib/sms";
import { normalizeEmail, normalizeUsPhone, normalizeInstagram, cleanText, type FieldErrors } from "@/lib/validation";
import type { ActionState } from "./action-state";

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
