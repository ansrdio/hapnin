import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getDb } from "@/lib/firebase-admin";
import { setStripeOnboarded } from "@/lib/organizers";
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
      // Phase 1: case "payment_intent.succeeded": …
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", event.type, err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
