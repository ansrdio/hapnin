import { NextResponse } from "next/server";
import { getOrderByPaymentIntent } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { fulfillPaidOrder } from "@/lib/checkout";

export const runtime = "nodejs";

// Polled by the confirmation page while the webhook creates the order + tickets.
//
// Reconcile-on-read: webhooks can be delayed, time out, or fail, and a buyer
// who has already paid must never be stranded on a spinner because of it. If
// no order exists yet, ask Stripe directly; if the PaymentIntent has actually
// succeeded and carries our pending_order_id, fulfil it right here. This is
// safe because fulfillPaidOrder is idempotent (order-exists + status guards)
// and computes every amount from the server-side pending order, never from
// the client — the only client input is the PI id, which is unguessable and
// is verified against Stripe before anything happens. We log loudly so a
// webhook failure stays visible instead of being masked.
const PI_RE = /^pi_[A-Za-z0-9]{8,}$/;

export async function GET(req: Request) {
  const pi = new URL(req.url).searchParams.get("pi");
  if (!pi) return NextResponse.json({ error: "missing_pi" }, { status: 400 });

  const order = await getOrderByPaymentIntent(pi);
  if (order) return NextResponse.json({ ready: true, orderId: order.id });

  if (PI_RE.test(pi)) {
    try {
      const intent = await getStripe().paymentIntents.retrieve(pi);
      const pendingId = intent.metadata?.pending_order_id;
      if (intent.status === "succeeded" && pendingId) {
        console.warn("order-status: succeeded PI with no order — reconciling (webhook missed?)", { pi, pendingId });
        await fulfillPaidOrder(pendingId, intent.id);
        const reconciled = await getOrderByPaymentIntent(pi);
        if (reconciled) return NextResponse.json({ ready: true, orderId: reconciled.id, reconciled: true });
      }
    } catch (err) {
      console.error("order-status reconcile error", pi, err);
    }
  }

  return NextResponse.json({ ready: false });
}
