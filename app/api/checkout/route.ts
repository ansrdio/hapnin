import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createCheckoutIntent } from "@/lib/checkout";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { normalizeUsPhone, normalizeEmail, normalizeZip, cleanText } from "@/lib/validation";

export const runtime = "nodejs";

// POST → validate the buyer server-side, create the destination-charge
// PaymentIntent + a pending order, return the client secret. All amounts are
// computed in createCheckoutIntent from the DB, never trusted from here.
export async function POST(req: Request) {
  const h = await headers();
  const ip = clientIpFrom(h);
  // Generous per-IP: a whole room on one venue Wi-Fi RSVPing at once shares an
  // address. Every amount and every field is validated server-side regardless.
  const rl = rateLimit(`checkout:${ip}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const phone = normalizeUsPhone(String(body.phone ?? ""));
  const email = normalizeEmail(String(body.email ?? ""));
  const postal_code = normalizeZip(String(body.zip ?? ""));
  const first_name = cleanText(String(body.firstName ?? ""), 80);
  const last_name = cleanText(String(body.lastName ?? ""), 80);
  const slug = String(body.slug ?? "");
  const tierId = String(body.tierId ?? "");
  const quantity = Number(body.quantity ?? 1);

  const zipRaw = String(body.zip ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.firstName = "Required.";
  // A wallet may hand us a single name; that's fine — last name is optional there.
  if (!last_name && body.wallet !== true) fieldErrors.lastName = "Required.";
  if (!phone) fieldErrors.phone = "US mobile number.";
  if (!email) fieldErrors.email = "Working email.";
  if (zipRaw && !postal_code) fieldErrors.zip = "5-digit ZIP."; // optional, but must be valid if given
  if (!slug || !tierId) fieldErrors.form = "Missing event or tier.";
  if (Object.keys(fieldErrors).length) return NextResponse.json({ fieldErrors }, { status: 400 });

  const scr = String(body.screening ?? "");
  const screening_interest = scr === "yes" ? true : scr === "no" ? false : null;

  // Group buying: named friends each get their own ticket on payment. Up to
  // quantity − 1; each needs a US mobile (tickets are keyed by phone), email
  // optional. Anything unparseable is dropped, never an error.
  const rawFriends = Array.isArray(body.friends) ? (body.friends as Record<string, unknown>[]).slice(0, Math.max(0, quantity - 1)) : [];
  const friends = rawFriends
    .map((f) => ({
      first_name: cleanText(String(f.first_name ?? ""), 60) || "Friend",
      phone: normalizeUsPhone(String(f.phone ?? "")),
      email: normalizeEmail(String(f.email ?? "")),
    }))
    .filter((f): f is { first_name: string; phone: string; email: string | null } => !!f.phone);

  try {
    const result = await createCheckoutIntent({
      slug,
      tierId,
      quantity,
      buyer: {
        phone: phone!,
        email: email!,
        first_name,
        last_name,
        postal_code: postal_code ?? null,
        screening_interest,
        marketing_opt_in: body.optIn !== false,
        show_name: body.showName !== false,
      },
      referral_source: body.ref ? cleanText(String(body.ref), 40) : null,
      promoter_code: body.p ? cleanText(String(body.p), 40) : null,
      promo_code: body.promo ? cleanText(String(body.promo), 24) : null,
      friend_code: body.friend ? cleanText(String(body.friend), 24).toLowerCase() : null,
      friends,
      ip,
      user_agent: h.get("user-agent"),
    });
    // Free/RSVP: the ticket already exists — the client goes straight to it.
    if (result.kind === "free") return NextResponse.json({ free: true, orderId: result.orderId, amounts: result.amounts });
    return NextResponse.json({ clientSecret: result.clientSecret, amounts: result.amounts });
  } catch (err) {
    const code = (err as Error).message;
    if (code === "INVALID_PROMO") return NextResponse.json({ fieldErrors: { promo: "That code isn’t valid." } }, { status: 400 });
    if (code === "SOLD_OUT") return NextResponse.json({ error: "sold_out" }, { status: 409 });
    if (code === "ORGANIZER_NOT_READY")
      return NextResponse.json({ error: "organizer_not_ready" }, { status: 409 });
    if (code === "NOT_ON_SALE") return NextResponse.json({ error: "not_on_sale" }, { status: 409 });
    if (code === "EVENT_NOT_FOUND" || code === "TIER_NOT_FOUND") return NextResponse.json({ error: "not_found" }, { status: 404 });
    console.error("checkout error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
