import "server-only";
import Stripe from "stripe";

// One Stripe client, secret key server-side only. The money rule (ADR + spec):
// buyers pay a PaymentIntent on the PLATFORM with transfer_data.destination =
// the organizer's connected account, on_behalf_of = same, and
// application_fee_amount = Hapnin's cut — so funds settle to the organizer and
// never rest in the platform balance. That lives in the checkout code (Phase 1);
// this module is just the client + onboarding helpers (Phase 0).

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY.");
  stripe = new Stripe(key);
  return stripe;
}
