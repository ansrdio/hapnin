import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { quoteCheckout } from "@/lib/checkout";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/validation";

export const runtime = "nodejs";

// POST → the server-computed amounts for a tier/quantity (+ promo or friend
// code), with nothing reserved and nothing created. The checkout page uses it
// to show the wallet button with the exact total the PaymentIntent will carry.
export async function POST(req: Request) {
  const h = await headers();
  const rl = rateLimit(`quote:${clientIpFrom(h)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const q = await quoteCheckout({
      slug: String(body.slug ?? ""),
      tierId: String(body.tierId ?? ""),
      quantity: Number(body.quantity ?? 1),
      promo_code: body.promo ? cleanText(String(body.promo), 24) : null,
      friend_code: body.friend ? cleanText(String(body.friend), 24).toLowerCase() : null,
    });
    return NextResponse.json({ amounts: q.amounts, free: q.amounts.total_cents === 0, quantity: q.qty });
  } catch (err) {
    const code = (err as Error).message;
    if (code === "INVALID_PROMO") return NextResponse.json({ fieldErrors: { promo: "That code isn’t valid." } }, { status: 400 });
    if (code === "SOLD_OUT") return NextResponse.json({ error: "sold_out" }, { status: 409 });
    if (code === "ORGANIZER_NOT_READY") return NextResponse.json({ error: "organizer_not_ready" }, { status: 409 });
    if (code === "NOT_ON_SALE") return NextResponse.json({ error: "not_on_sale" }, { status: 409 });
    if (code === "EVENT_NOT_FOUND" || code === "TIER_NOT_FOUND") return NextResponse.json({ error: "not_found" }, { status: 404 });
    console.error("quote error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
