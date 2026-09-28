// Shared setup for the money-path integration tests. These run the REAL lib
// modules against the Firestore emulator (npm run test:money), with a fake
// Stripe client and named fault points, so partial failures can be forced at
// exact moments and the recovery proven.

process.env.HAPNIN_TEST = "1";
process.env.QR_SECRET ||= "test-qr-secret";
process.env.NEXT_PUBLIC_SITE_URL ||= "https://test.hapnin.now";
delete process.env.BREVO_API_KEY; // email → console
delete process.env.TWILIO_ACCOUNT_SID; // sms → console

import { getDb } from "../../lib/firebase-admin";
import { setStripeForTests } from "../../lib/stripe";
import { clearFaults } from "../../lib/faults";
import { createEvent } from "../../lib/events";
import { createOrganizer } from "../../lib/organizers";

const PROJECT = process.env.GCLOUD_PROJECT || "demo-hapnin";

export async function resetDb(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("FIRESTORE_EMULATOR_HOST not set — run via npm run test:money");
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`emulator reset failed: ${res.status}`);
  clearFaults();
}

export type FakeStripe = {
  calls: { method: string; args: unknown[] }[];
  refundFailures: number; // how many refunds.create calls should throw before succeeding
  piStatus: Record<string, string>;
};

/** A Stripe stand-in: records calls, simulates refund failures, idempotency by key. */
export function installFakeStripe(): FakeStripe {
  const state: FakeStripe = { calls: [], refundFailures: 0, piStatus: {} };
  const refundsByKey = new Map<string, { id: string }>();
  let n = 0;
  const fake = {
    refunds: {
      create: async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
        state.calls.push({ method: "refunds.create", args: [params, opts] });
        if (state.refundFailures > 0) {
          state.refundFailures--;
          throw Object.assign(new Error("Stripe is unavailable"), { type: "StripeConnectionError" });
        }
        const key = opts?.idempotencyKey ?? `nokey_${n++}`;
        if (!refundsByKey.has(key)) refundsByKey.set(key, { id: `re_${n++}` });
        return refundsByKey.get(key);
      },
    },
    paymentIntents: {
      retrieve: async (id: string) => {
        state.calls.push({ method: "paymentIntents.retrieve", args: [id] });
        return { id, status: state.piStatus[id] ?? "succeeded", metadata: {} };
      },
      cancel: async (id: string) => {
        state.calls.push({ method: "paymentIntents.cancel", args: [id] });
        return { id, status: "canceled" };
      },
    },
  };
  setStripeForTests(fake);
  return state;
}

let seq = 0;

/** One organizer (payable) + one on-sale event with the given tiers. */
export async function seedEvent(opts: { tiers?: { name: string; price_cents: number; quantity_total: number }[]; is_sample?: boolean } = {}) {
  const i = ++seq;
  const organizer = await createOrganizer({
    name: `Test Org ${i}`,
    handle: `test-org-${i}-${Date.now().toString(36)}`,
    email: `org${i}.${Date.now()}@example.com`,
    phone: "+14805550100",
  });
  await getDb().collection("organizers").doc(organizer.id).update({ stripe_account_id: "acct_test", stripe_onboarded: true });
  const event = await createEvent({
    organizer_id: organizer.id,
    title: `Test Event ${i}`,
    slug: `test-event-${i}-${Date.now().toString(36)}`,
    venue_name: "Test Venue",
    venue_address: "1 Test St",
    city: "Phoenix",
    state: "AZ",
    starts_at: Date.now() + 14 * 86_400_000,
    status: "on_sale",
    category: "nightlife",
    is_sample: opts.is_sample ?? false,
    tiers: (opts.tiers ?? [{ name: "General", price_cents: 2500, quantity_total: 10 }]).map((t) => ({ ...t, sales_start_at: null, sales_end_at: null })),
  });
  const tiersSnap = await getDb().collection("events").doc(event.id).collection("tiers").get();
  const tier = tiersSnap.docs[0];
  return { organizer, event, tierId: tier.id };
}

/** A reserved pending order + reserved inventory, as createCheckoutIntent leaves it just before payment. */
export async function seedPendingOrder(input: { eventId: string; tierId: string; organizerId: string; quantity: number; priceCents: number; pi: string; phone?: string; email?: string }) {
  const db = getDb();
  const tierRef = db.collection("events").doc(input.eventId).collection("tiers").doc(input.tierId);
  await db.runTransaction(async (tx) => {
    const t = await tx.get(tierRef);
    tx.update(tierRef, { quantity_sold: (t.data()!.quantity_sold ?? 0) + input.quantity });
  });
  const subtotal = input.priceCents * input.quantity;
  const ref = db.collection("pending_orders").doc();
  await ref.set({
    event_id: input.eventId,
    tier_id: input.tierId,
    organizer_id: input.organizerId,
    quantity: input.quantity,
    subtotal_cents: subtotal,
    discount_cents: 0,
    card_fee_cents: Math.round(subtotal * 0.029 + 30 * input.quantity),
    application_fee_cents: Math.round(subtotal * 0.03 + 50 * input.quantity),
    total_cents: subtotal + Math.round(subtotal * 0.029 + 30 * input.quantity),
    buyer: {
      phone: input.phone ?? "+16025550142",
      email: input.email ?? "buyer@example.com",
      first_name: "Test",
      last_name: "Buyer",
      postal_code: null,
      screening_interest: null,
      marketing_opt_in: false,
      show_name: true,
    },
    referral_source: null,
    promoter_link_id: null,
    promo_code_id: null,
    referred_by_order_id: null,
    friends: [],
    consent: { granted: false, text: "", ip: null, user_agent: null },
    status: "reserved",
    payment_intent_id: input.pi,
    expires_at: Date.now() + 30 * 60 * 1000,
  });
  return ref.id;
}

export async function countWhere(collection: string, field: string, value: unknown): Promise<number> {
  return (await getDb().collection(collection).where(field, "==", value).get()).size;
}

export async function data(path: string): Promise<FirebaseFirestore.DocumentData | undefined> {
  return (await getDb().doc(path).get()).data();
}
