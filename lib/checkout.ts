import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getStripe } from "./stripe";
import { getEventById, getEventBySlug, getTier, reserveInventory, releaseInventory } from "./events";
import { getOrganizerById } from "./organizers";
import { findOrCreateBuyer, recordConsent } from "./buyers";
import { resolvePromoterCode, adjustPromoterStats } from "./promoters";
import { qrToken } from "./qr";
import { sendSMS } from "./sms";

// ── Money ────────────────────────────────────────────────────────────────────
// Every amount is computed HERE, server-side, from the tier price in Firestore —
// never trusted from the client. Model (see docs/architecture.md):
//   buyer pays  = face value + card processing (buyers cover card fees)
//   organizer nets ≈ face value (Stripe fee is covered by the added card fee)
//   Hapnin keeps = application_fee_amount (0 on a first/launch event)
const CARD = { pct: 0.029, fixed: 30 }; // Stripe standard, buyer-covered
const PLATFORM = { pct: 0.03, fixed: 50 }; // Hapnin ongoing (3% + 50¢/ticket)
export const MAX_QTY = 8;

export const CHECKOUT_CONSENT_TEXT =
  "Yes — text me about Hapnin and the organizers of events you attend, about African events near me. Reply STOP to opt out.";

export type Amounts = {
  subtotal_cents: number;
  card_fee_cents: number;
  application_fee_cents: number;
  total_cents: number;
};

export function computeAmounts(priceCents: number, qty: number, isFirstEvent: boolean): Amounts {
  const subtotal = priceCents * qty;
  const card = Math.round(subtotal * CARD.pct + CARD.fixed * qty);
  const application = isFirstEvent ? 0 : Math.round(subtotal * PLATFORM.pct + PLATFORM.fixed * qty);
  return {
    subtotal_cents: subtotal,
    card_fee_cents: card,
    application_fee_cents: application,
    total_cents: subtotal + card,
  };
}

export type CheckoutInput = {
  slug: string;
  tierId: string;
  quantity: number;
  buyer: {
    phone: string; // E.164
    email: string;
    first_name: string;
    last_name: string;
    postal_code: string;
    screening_interest: boolean | null;
    marketing_opt_in: boolean;
  };
  referral_source: string | null;
  promoter_code: string | null;
  ip: string | null;
  user_agent: string | null;
};

/**
 * Reserve inventory (atomic), create the destination-charge PaymentIntent, and a
 * pending_orders doc the webhook fulfils on success. Returns the client secret.
 * If anything fails after reserving, the hold is released.
 */
export async function createCheckoutIntent(
  input: CheckoutInput
): Promise<{ clientSecret: string; amounts: Amounts }> {
  const db = getDb();
  const event = await getEventBySlug(input.slug);
  if (!event) throw new Error("EVENT_NOT_FOUND");
  if (event.status !== "on_sale") throw new Error("NOT_ON_SALE");

  const tier = await getTier(event.id, input.tierId);
  if (!tier) throw new Error("TIER_NOT_FOUND");

  const organizer = await getOrganizerById(event.organizer_id);
  if (!organizer?.stripe_account_id || !organizer.stripe_onboarded) throw new Error("ORGANIZER_NOT_READY");

  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(input.quantity)));
  const amounts = computeAmounts(tier.price_cents, qty, event.is_first_event);

  // Resolve promoter attribution (best-effort; a bad code just isn't attributed).
  const promoterLink = input.promoter_code ? await resolvePromoterCode(event.id, input.promoter_code) : null;

  // Reserve BEFORE creating the intent.
  await reserveInventory(event.id, tier.id, qty);

  try {
    const pendingRef = db.collection("pending_orders").doc();
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: amounts.total_cents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: organizer.stripe_account_id },
      on_behalf_of: organizer.stripe_account_id,
      // 0 on a free first event → omit so the full amount transfers to the organizer.
      ...(amounts.application_fee_cents > 0
        ? { application_fee_amount: amounts.application_fee_cents }
        : {}),
      metadata: {
        pending_order_id: pendingRef.id,
        event_id: event.id,
        tier_id: tier.id,
        quantity: String(qty),
      },
    });

    await pendingRef.set({
      status: "reserved",
      payment_intent_id: pi.id,
      event_id: event.id,
      tier_id: tier.id,
      organizer_id: event.organizer_id,
      quantity: qty,
      ...amounts,
      buyer: input.buyer,
      referral_source: input.referral_source,
      promoter_link_id: promoterLink?.id ?? null,
      consent: {
        granted: input.buyer.marketing_opt_in,
        text: CHECKOUT_CONSENT_TEXT,
        ip: input.ip,
        user_agent: input.user_agent,
      },
      expires_at: Date.now() + 30 * 60 * 1000,
      created_at: FieldValue.serverTimestamp(),
    });

    return { clientSecret: pi.client_secret!, amounts };
  } catch (err) {
    await releaseInventory(event.id, tier.id, qty); // don't strand the hold
    throw err;
  }
}

/**
 * Fulfil a paid PaymentIntent (called by the webhook). Idempotent: if an order
 * already exists for this PaymentIntent, it's a no-op. Creates buyer + order +
 * one ticket per admission + consent, bumps event counters, and texts the link.
 */
export async function fulfillPaidOrder(pendingOrderId: string, paymentIntentId: string): Promise<void> {
  const db = getDb();

  // Idempotency guard #1: order already exists for this PI.
  const existing = await db.collection("orders").where("stripe_payment_intent_id", "==", paymentIntentId).limit(1).get();
  if (!existing.empty) return;

  const pendingRef = db.collection("pending_orders").doc(pendingOrderId);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) return;
  const p = pendingSnap.data()!;
  if (p.status !== "reserved") return; // #2: already handled

  const event = await getEventById(p.event_id);
  if (!event) return;

  await findOrCreateBuyer({
    phone: p.buyer.phone,
    email: p.buyer.email,
    first_name: p.buyer.first_name,
    last_name: p.buyer.last_name,
    postal_code: p.buyer.postal_code,
    screening_interest: p.buyer.screening_interest,
    sms_marketing_opt_in: p.buyer.marketing_opt_in,
    email_marketing_opt_in: p.buyer.marketing_opt_in,
    first_event_id: event.id,
  });

  // days_before_event frozen at purchase (never re-derived).
  const daysBefore = Math.max(0, Math.ceil((event.starts_at - Date.now()) / 86_400_000));

  const orderRef = db.collection("orders").doc();
  await orderRef.set({
    event_id: p.event_id,
    buyer_id: p.buyer.phone,
    tier_id: p.tier_id,
    quantity: p.quantity,
    subtotal_cents: p.subtotal_cents,
    fee_cents: p.application_fee_cents,
    total_cents: p.total_cents,
    stripe_payment_intent_id: paymentIntentId,
    status: "paid",
    channel: "online",
    days_before_event: daysBefore,
    referral_source: p.referral_source ?? null,
    promoter_link_id: p.promoter_link_id ?? null,
    created_at: FieldValue.serverTimestamp(),
  });

  // One ticket per admission; QR signed with the ticket's own id.
  const batch = db.batch();
  for (let i = 0; i < p.quantity; i++) {
    const tRef = db.collection("tickets").doc();
    batch.set(tRef, {
      order_id: orderRef.id,
      event_id: p.event_id,
      buyer_id: p.buyer.phone,
      qr_token: qrToken(tRef.id),
      is_comp: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // Consent (verbatim), if the buyer opted in.
  if (p.consent?.granted) {
    for (const scope of ["hapnin", "organizer_events"] as const) {
      await recordConsent({
        phone: p.buyer.phone,
        scope,
        channel: "sms",
        action: "granted",
        source: "checkout",
        event_id: p.event_id,
        ip_address: p.consent.ip,
        user_agent: p.consent.user_agent,
        consent_text: p.consent.text,
      });
    }
  }

  // Bump event counters.
  await db.collection("events").doc(p.event_id).update({
    tickets_sold: FieldValue.increment(p.quantity),
    gross_cents: FieldValue.increment(p.subtotal_cents),
  });

  // Attribute to the promoter, if any.
  if (p.promoter_link_id) {
    await adjustPromoterStats(p.promoter_link_id, { orders: 1, tickets: p.quantity, gross: p.subtotal_cents });
  }

  await pendingRef.update({ status: "fulfilled", order_id: orderRef.id });

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  await sendSMS({
    to: p.buyer.phone,
    body: `You’re in — ${p.quantity} ticket${p.quantity > 1 ? "s" : ""} for ${event.title}. ${site}/t/${orderRef.id}`,
  });
}

/** Release the hold when a PaymentIntent fails or is canceled. */
export async function releaseHold(pendingOrderId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection("pending_orders").doc(pendingOrderId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const p = snap.data()!;
  if (p.status !== "reserved") return;
  await releaseInventory(p.event_id, p.tier_id, p.quantity);
  await ref.update({ status: "released" });
}
