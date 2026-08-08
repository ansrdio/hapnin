"use server";

import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "@/lib/firestore";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import {
  normalizeUsPhone,
  normalizeZip,
  normalizeEmail,
  normalizeInstagram,
  cleanText,
  type FieldErrors,
} from "@/lib/validation";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

export const initialState: FormState = { status: "idle" };

const GENERIC_ERROR =
  "Something went wrong on our end. Give it another go in a moment.";

// -- Audience: phone + zip ----------------------------------------------------
export async function submitAudience(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const hp = String(formData.get("company") ?? ""); // honeypot
  if (hp.trim() !== "") {
    // Looks like a bot — pretend it worked, insert nothing.
    return { status: "success", message: "You're on the list." };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const rl = rateLimit(`audience:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return {
      status: "error",
      message: `Too many tries. Wait ${rl.retryAfterSec}s and try again.`,
    };
  }

  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const postal_code = normalizeZip(String(formData.get("zip") ?? ""));

  const fieldErrors: FieldErrors = {};
  if (!phone) fieldErrors.phone = "Enter a US mobile number, like (602) 555-0142.";
  if (!postal_code) fieldErrors.zip = "5-digit ZIP, so we know your city.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  try {
    const db = getDb();
    // Phone (E.164) is the doc id, so the same number can't sign up twice.
    // create() throws ALREADY_EXISTS on a duplicate — treat that as success.
    await db.collection("audience_signups").doc(phone!).create({
      phone,
      postal_code,
      source: "landing_hero",
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) {
      return { status: "success", message: "You're already on the list — we'll text you." };
    }
    console.error("audience action error", err);
    return { status: "error", message: GENERIC_ERROR };
  }

  return { status: "success", message: "You're in. We'll text you what's hapnin." };
}

// -- Organizer: name + email + instagram + city -------------------------------
export async function submitOrganizer(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const hp = String(formData.get("website") ?? ""); // honeypot
  if (hp.trim() !== "") {
    return { status: "success", message: "Got it — we'll be in touch." };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const rl = rateLimit(`organizer:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return {
      status: "error",
      message: `Too many tries. Wait ${rl.retryAfterSec}s and try again.`,
    };
  }

  const name = cleanText(String(formData.get("name") ?? ""), 120);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const city = cleanText(String(formData.get("city") ?? ""), 120);
  const instagram = normalizeInstagram(String(formData.get("instagram") ?? ""));
  const note = cleanText(String(formData.get("note") ?? ""), 500) || null;

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Tell us who you are.";
  if (!email) fieldErrors.email = "We need a working email to reach you.";
  if (!city) fieldErrors.city = "Which city do you run events in?";
  if (instagram === null) fieldErrors.instagram = "Handle only — letters, numbers, . and _";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  try {
    const db = getDb();
    await db.collection("organizer_signups").add({
      name,
      email,
      instagram_handle: instagram ?? null,
      city,
      note,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("organizer action error", err);
    return { status: "error", message: GENERIC_ERROR };
  }

  return {
    status: "success",
    message: "You're on the list. We'll reach out about your next event.",
  };
}
