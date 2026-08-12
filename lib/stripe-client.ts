"use client";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Browser Stripe.js, loaded once. Publishable key is public by design.
let promise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (!promise) {
    promise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  }
  return promise;
}
