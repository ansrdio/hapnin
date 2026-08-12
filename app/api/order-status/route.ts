import { NextResponse } from "next/server";
import { getOrderByPaymentIntent } from "@/lib/orders";

export const runtime = "nodejs";

// Polled by the confirmation page while the webhook creates the order + tickets.
export async function GET(req: Request) {
  const pi = new URL(req.url).searchParams.get("pi");
  if (!pi) return NextResponse.json({ error: "missing_pi" }, { status: 400 });
  const order = await getOrderByPaymentIntent(pi);
  return NextResponse.json(order ? { ready: true, orderId: order.id } : { ready: false });
}
