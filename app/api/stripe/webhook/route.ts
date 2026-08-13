import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";
import { setStripeOnboarded } from "@/lib/organizers";
import { fulfillPaidOrder, releaseHold } from "@/lib/checkout";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe webhook. IDEMPOTENCY: Stripe retries deliveries, so every event id is
// recorded once in `webhook_events` via create() — a duplicate delivery is a
// no-op. Signature is verified against STRIPE_WEBHOOK_SECRET before anything.
//
// Phase 0 handles Connect onboarding (account.updated). Phase 1 adds
// payment_intent.succeeded → order + tickets.

async function alreadyProcessed(eventId: string): Promise<boolean> {
  try {
    await getDb().collection("webhook_events").doc(eventId).create({
      created_at: FieldValue.serverTimestamp(),
    });
    return false;
  } catch {
    return true; // ALREADY_EXISTS → we've seen this event
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `bad_signature: ${(err as Error).message}` }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const ready = !!account.details_submitted && !!account.charges_enabled;
        await setStripeOnboarded(account.id, ready);
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const pendingId = pi.metadata?.pending_order_id;
        if (pendingId) await fulfillPaidOrder(pendingId, pi.id);
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const pendingId = pi.metadata?.pending_order_id;
        if (pendingId) await releaseHold(pendingId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", event.type, err);
    // Un-record the dedup marker so Stripe's retry (or a manual Resend) can
    // re-run the handler — otherwise a single transient failure strands the
    // order forever, since every retry would be treated as a duplicate.
    await getDb().collection("webhook_events").doc(event.id).delete().catch(() => {});
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
