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
  const rl = rateLimit(`checkout:${ip}`, { limit: 10, windowMs: 60_000 });
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

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.firstName = "Required.";
  if (!last_name) fieldErrors.lastName = "Required.";
  if (!phone) fieldErrors.phone = "US mobile number.";
  if (!email) fieldErrors.email = "Working email.";
  if (!postal_code) fieldErrors.zip = "5-digit ZIP.";
  if (!slug || !tierId) fieldErrors.form = "Missing event or tier.";
  if (Object.keys(fieldErrors).length) return NextResponse.json({ fieldErrors }, { status: 400 });

  const scr = String(body.screening ?? "");
  const screening_interest = scr === "yes" ? true : scr === "no" ? false : null;

  try {
    const { clientSecret, amounts } = await createCheckoutIntent({
      slug,
      tierId,
      quantity,
      buyer: {
        phone: phone!,
        email: email!,
        first_name,
        last_name,
        postal_code: postal_code!,
        screening_interest,
        marketing_opt_in: body.optIn !== false,
      },
      referral_source: body.ref ? cleanText(String(body.ref), 40) : null,
      promoter_code: body.p ? cleanText(String(body.p), 40) : null,
      promo_code: body.promo ? cleanText(String(body.promo), 24) : null,
      ip,
      user_agent: h.get("user-agent"),
    });
    return NextResponse.json({ clientSecret, amounts });
  } catch (err) {
    const code = (err as Error).message;
    if (code === "INVALID_PROMO") return NextResponse.json({ fieldErrors: { promo: "That code isn’t valid." } }, { status: 400 });
    if (code === "SOLD_OUT") return NextResponse.json({ error: "sold_out" }, { status: 409 });
    if (code === "ORGANIZER_NOT_READY")
      return NextResponse.json({ error: "organizer_not_ready" }, { status: 409 });
    if (code === "NOT_ON_SALE") return NextResponse.json({ error: "not_on_sale" }, { status: 409 });
    console.error("checkout error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
