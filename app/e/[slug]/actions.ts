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
  const rl = rateLimit(`waitlist:${clientIpFrom(h)}`, { limit: 6, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  const slug = String(formData.get("slug") ?? "");
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const name = cleanText(String(formData.get("name") ?? ""), 80) || null;
  const quantity = parseInt(String(formData.get("quantity") ?? "1"), 10) || 1;

  if (!phone) return { status: "error", fieldErrors: { phone: "Enter a US mobile number." } };

  const event = await getEventBySlug(slug);
  if (!event) return { status: "error", message: "Event not found." };

  await joinWaitlist({ eventId: event.id, phone, name, quantity });
  return { status: "success", message: "You’re on the list — we’ll text you if tickets open up." };
}
