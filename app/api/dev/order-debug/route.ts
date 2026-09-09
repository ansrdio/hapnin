import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";
import { getOrderByPaymentIntent } from "@/lib/orders";

export const runtime = "nodejs";

// Admin-only, READ-ONLY diagnostic for a paid-but-unfulfilled PaymentIntent.
// Answers, in one JSON: what Stripe thinks the PI's status/metadata is, the
// sequence of payment_intent.* events Stripe emitted for it, which of those we
// actually received (dedup marker in webhook_events), the pending order's
// state, and whether an order exists. Writes nothing. Remove before launch.
export async function GET(req: Request) {
  await requireAdmin();
  const pi = new URL(req.url).searchParams.get("pi");
  if (!pi || !/^pi_[A-Za-z0-9]{8,}$/.test(pi)) {
    return NextResponse.json({ error: "pass ?pi=pi_..." }, { status: 400 });
  }
  const stripe = getStripe();
  const db = getDb();
  const out: Record<string, unknown> = { pi };

  try {
    const intent = await stripe.paymentIntents.retrieve(pi);
    out.stripe = {
      status: intent.status,
      amount: intent.amount,
      metadata: intent.metadata,
      latest_charge: intent.latest_charge,
      last_payment_error: intent.last_payment_error?.message ?? null,
      created: new Date(intent.created * 1000).toISOString(),
    };
  } catch (err) {
    out.stripe = { error: (err as Error).message };
  }

  // Every payment_intent.* event Stripe emitted for this PI, oldest first, and
  // whether our webhook recorded each one (received = we saw it at least once).
  try {
    const events = await stripe.events.list({ type: "payment_intent.*", limit: 100 });
    const mine = events.data
      .filter((e) => (e.data.object as { id?: string }).id === pi)
      .sort((a, b) => a.created - b.created);
    out.stripe_events = await Promise.all(
      mine.map(async (e) => ({
        id: e.id,
        type: e.type,
        at: new Date(e.created * 1000).toISOString(),
        received_by_webhook: (await db.collection("webhook_events").doc(e.id).get()).exists,
      }))
    );
  } catch (err) {
    out.stripe_events = { error: (err as Error).message };
  }

  const pendingId = (out.stripe as { metadata?: { pending_order_id?: string } })?.metadata?.pending_order_id;
  if (pendingId) {
    const snap = await db.collection("pending_orders").doc(pendingId).get();
    out.pending = snap.exists
      ? (({ status, order_id, total_cents, expires_at, event_id, tier_id, quantity }) => ({
          id: snap.id, status, order_id: order_id ?? null, total_cents, event_id, tier_id, quantity,
          expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        }))(snap.data()!)
      : { id: pendingId, exists: false };
  } else {
    out.pending = "no pending_order_id in PI metadata";
  }

  const order = await getOrderByPaymentIntent(pi);
  out.order = order ? { id: order.id, status: order.status } : null;

  return NextResponse.json(out);
}
