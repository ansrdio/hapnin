"use server";

import { headers } from "next/headers";
import { joinWaitlist } from "@/lib/waitlist";
import { getEventBySlug } from "@/lib/events";
import { normalizeUsPhone, cleanText } from "@/lib/validation";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/admin/action-state";

/** Public: join a sold-out event's waitlist. Rate-limited, no login. */
export async function joinWaitlistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`waitlist:${clientIpFrom(h)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  const slug = String(formData.get("slug") ?? "");
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const name = cleanText(String(formData.get("name") ?? ""), 80) || null;
  const quantity = parseInt(String(formData.get("quantity") ?? "1"), 10) || 1;

  if (!phone) return { status: "error", fieldErrors: { phone: "Enter a US mobile number." } };
  // Email is optional but is the channel that works today (texting waits on
  // carrier approval). Light validation; normalized to lowercase.
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return { status: "error", fieldErrors: { email: "That email doesn’t look right." } };
  }
  const email = rawEmail || null;

  const event = await getEventBySlug(slug);
  if (!event) return { status: "error", message: "Event not found." };

  await joinWaitlist({ eventId: event.id, phone, email, name, quantity });
  return {
    status: "success",
    message: email
      ? "You’re on the list — we’ll email you the moment tickets open up."
      : "You’re on the list — we’ll text you if tickets open up. Add an email next time to hear sooner.",
  };
}
