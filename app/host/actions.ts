"use server";

import { headers } from "next/headers";
import { createOrganizer, getOrganizerByEmail } from "@/lib/organizers";
import { resolveLaunchCode } from "@/lib/launch";
import { normalizeEmail, normalizeUsPhone, normalizeInstagram, cleanText, type FieldErrors } from "@/lib/validation";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/admin/action-state";

function normalizeHandle(raw: string): string | null {
  const h = (raw || "").trim().toLowerCase().replace(/^@+/, "");
  return /^[a-z0-9][a-z0-9._-]{1,30}$/.test(h) ? h : null;
}

/**
 * Public self-serve organizer sign-up. Anyone can create a host account; they
 * then connect Stripe payouts from their dashboard before selling. If the email
 * already hosts, we just point them to sign in (no duplicate).
 */
export async function signupOrganizerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`host-signup:${clientIpFrom(h)}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  const name = cleanText(String(formData.get("name") ?? ""), 120);
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const instagram = normalizeInstagram(String(formData.get("instagram") ?? ""));
  // Where they came from (?src= on /host, e.g. the launch-night QR) and an
  // optional launch code that waives Hapnin's fee for a while.
  const src = cleanText(String(formData.get("src") ?? ""), 40) || null;
  const codeRaw = cleanText(String(formData.get("code") ?? ""), 24);
  const offer = codeRaw ? resolveLaunchCode(codeRaw) : null;

  // Already a host → success, they'll get a sign-in link (no duplicate created).
  if (email && (await getOrganizerByEmail(email))) return { status: "success" };

  const fieldErrors: FieldErrors = {};
  if (!name) fieldErrors.name = "Your name or crew name.";
  if (!handle) fieldErrors.handle = "Lowercase letters, numbers, . _ - (this is your hapnin.now/o/ page).";
  if (!email) fieldErrors.email = "A working email — this is your login.";
  if (!phone) fieldErrors.phone = "US mobile, e.g. (602) 555-0142.";
  if (instagram === null) fieldErrors.instagram = "Handle only, e.g. auracollective.";
  if (codeRaw && !offer) fieldErrors.code = "That code isn’t valid — leave it blank to sign up without one.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  try {
    await createOrganizer({
      name,
      handle: handle!,
      email: email!,
      phone: phone!,
      instagram_handle: instagram ?? null,
      signup_source: offer ? `${src ?? "web"}+code:${offer.code}` : src,
      fee_waived_until: offer ? Date.now() + offer.days * 86_400_000 : null,
    });
  } catch (err) {
    if ((err as Error).message === "HANDLE_TAKEN") return { status: "error", fieldErrors: { handle: "That handle is taken." } };
    console.error("host signup error", err);
    return { status: "error", message: "Couldn’t create your account. Try again." };
  }
  return { status: "success" };
}
