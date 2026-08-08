"use server";

import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firestore";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { notifyNewPitchLead } from "@/lib/notify";
import {
  normalizeUsPhone,
  normalizeEmail,
  normalizeInstagram,
  normalizeDate,
  parseAttendance,
  cleanText,
  type FieldErrors,
} from "@/lib/validation";

export type PitchState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

export const initialPitchState: PitchState = { status: "idle" };

const GENERIC_ERROR =
  "Something went wrong on our end. Give it another go in a moment.";

export async function submitPitch(
  _prev: PitchState,
  formData: FormData
): Promise<PitchState> {
  // Honeypot — hidden field no human fills in.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { status: "success", message: "Got it. I'll reply within a day." };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const rl = rateLimit(`pitch:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return {
      status: "error",
      message: `Too many tries. Wait ${rl.retryAfterSec}s and try again.`,
    };
  }

  const name = cleanText(String(formData.get("name") ?? ""), 120);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const instagram = normalizeInstagram(String(formData.get("instagram") ?? ""));
  const event_name = cleanText(String(formData.get("event_name") ?? ""), 160) || null;
  const event_date = normalizeDate(String(formData.get("event_date") ?? ""));
  const expected_attendance = parseAttendance(
    String(formData.get("expected_attendance") ?? "")
  );
  const note = cleanText(String(formData.get("note") ?? ""), 800) || null;

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Tell me who you are.";
  if (!email) fieldErrors.email = "I need a working email to reach you.";
  if (!phone) fieldErrors.phone = "A US mobile number, like (602) 555-0142.";
  if (instagram === null) fieldErrors.instagram = "Handle only — letters, numbers, . and _";
  if (event_date === null) fieldErrors.event_date = "Use the date picker, or leave it blank.";
  if (expected_attendance === null)
    fieldErrors.expected_attendance = "A number, or leave it blank.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const lead = {
    name,
    email: email as string,
    phone: phone as string,
    instagram_handle: instagram ?? null,
    event_name,
    event_date: event_date ?? null,
    expected_attendance: expected_attendance ?? null,
    note,
  };

  try {
    const db = getDb();
    await db.collection("organizer_pitch_leads").add({
      ...lead,
      created_at: FieldValue.serverTimestamp(),
    });
    // Best-effort notification; never let it fail the submission.
    try {
      await notifyNewPitchLead(lead);
    } catch (notifyErr) {
      console.error("pitch notify error", notifyErr);
    }
  } catch (err) {
    console.error("pitch action error", err);
    return { status: "error", message: GENERIC_ERROR };
  }

  return { status: "success", message: "Got it. I'll reply within a day." };
}
