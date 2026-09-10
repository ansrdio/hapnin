"use server";

import { headers } from "next/headers";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/validation";
import { getOrganizerById } from "@/lib/organizers";
import { followOrganizer } from "@/lib/contacts";
import type { ActionState } from "@/app/admin/action-state";

// "Get updates from X" — a buyer's own opt-in to an organizer's announcements.
// Rate-limited per IP; records the consent evidence with the contact.
export async function followOrganizerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`follow:${clientIpFrom(h)}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!rl.ok) return { status: "error", message: "Too many tries — give it a few minutes." };

  const organizerId = String(formData.get("organizer_id") ?? "");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { status: "error", fieldErrors: { email: "Enter a working email." } };

  const organizer = await getOrganizerById(organizerId);
  if (!organizer) return { status: "error", message: "Organizer not found." };

  try {
    await followOrganizer({ organizerId, email, ip: clientIpFrom(h), userAgent: h.get("user-agent") });
    return {
      status: "success",
      message: `You’re in — ${organizer.name} will email you when something’s announced. Unsubscribe any time.`,
    };
  } catch (err) {
    console.error("followOrganizer error", err);
    return { status: "error", message: "Something went wrong. Try again." };
  }
}
