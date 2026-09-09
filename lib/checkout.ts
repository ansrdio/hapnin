import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getStripe } from "./stripe";
import { getEventById, getEventBySlug, getTier, reserveInventory, releaseInventory } from "./events";
import { getOrganizerById } from "./organizers";
import { findOrCreateBuyer, recordConsent } from "./buyers";
import { resolvePromoterCode, adjustPromoterStats } from "./promoters";
import { resolvePromo, promoDiscountCents, adjustPromoRedemption } from "./promos";
import { qrToken } from "./qr";
import { sendSMS } from "./sms";
import { sendTicketEmail } from "./email";

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
  subtotal_cents: number; // face value after any discount
  discount_cents: number;
  card_fee_cents: number;
  application_fee_cents: number;
  total_cents: number;
};

export function computeAmounts(priceCents: number, qty: number, isFirstEvent: boolean, discountCents = 0): Amounts {
  const gross = priceCents * qty;
  const discount = Math.max(0, Math.min(discountCents, gross));
  const subtotal = gross - discount;
  const card = Math.round(subtotal * CARD.pct + CARD.fixed * qty);
  const application = isFirstEvent ? 0 : Math.round(subtotal * PLATFORM.pct + PLATFORM.fixed * qty);
  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
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
  promo_code: string | null;
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

  // Sale window (authoritative; the UI hides these but never trust it).
  const now = Date.now();
  if (tier.sales_start_at && now < tier.sales_start_at) throw new Error("NOT_ON_SALE");
  if (tier.sales_end_at && now > tier.sales_end_at) throw new Error("SOLD_OUT");

  const organizer = await getOrganizerById(event.organizer_id);
  if (!organizer?.stripe_account_id || !organizer.stripe_onboarded) throw new Error("ORGANIZER_NOT_READY");

  // A table sells as one unit (it admits `seats` guests); GA sells up to MAX_QTY.
  const qty = tier.kind === "table" ? 1 : Math.max(1, Math.min(MAX_QTY, Math.floor(input.quantity)));

  // Promo code: an invalid one the buyer typed is an error; no code is fine.
  let promo = null;
  if (input.promo_code) {
    promo = await resolvePromo(event.id, input.promo_code);
    if (!promo) throw new Error("INVALID_PROMO");
  }
  const discount = promo ? promoDiscountCents(promo, tier.price_cents * qty) : 0;
  const amounts = computeAmounts(tier.price_cents, qty, event.is_first_event, discount);

  // Resolve promoter attribution (best-effort; a bad code just isn't attributed).
  const promoterLink = input.promoter_code ? await resolvePromoterCode(event.id, input.promoter_code) : null;

  // Free any abandoned holds on this event first (each one reconciled against
  // Stripe), so a walked-away checkout never blocks a real buyer. Best-effort:
  // a sweep failure must never stop a sale.
  await sweepExpiredHolds({ eventId: event.id, limit: 25 }).catch((err) =>
    console.warn("pre-checkout sweep failed", err)
  );

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
      promo_code_id: promo?.id ?? null,
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
  // Every early exit below is a silent no-op to the webhook (it still returns
  // 200), so log the reason — otherwise a paid-but-unfulfilled order leaves no
  // trace to debug from.
  if (!pendingSnap.exists) {
    console.warn("fulfillPaidOrder: pending order missing", { pendingOrderId, paymentIntentId });
    return;
  }
  const p = pendingSnap.data()!;
  if (p.status === "fulfilled") return; // #2: already handled

  // A PaymentIntent can fail once and then succeed on retry (a declined card,
  // an Apple Pay re-tap). If a payment_failed webhook released the hold in
  // between, the money has still been captured by the time we're here — the
  // buyer must get their ticket. Re-take the inventory and carry on; only give
  // up if the tier genuinely sold out in the gap (then it needs a refund).
  if (p.status === "released") {
    try {
      await reserveInventory(p.event_id, p.tier_id, p.quantity);
      await pendingRef.update({ status: "reserved" });
      console.warn("fulfillPaidOrder: re-reserved a released hold for a succeeded payment", { pendingOrderId, paymentIntentId });
    } catch (err) {
      console.error("fulfillPaidOrder: PAID BUT SOLD OUT — needs refund", { pendingOrderId, paymentIntentId, err });
      return;
    }
  } else if (p.status !== "reserved") {
    console.warn("fulfillPaidOrder: unexpected pending status, skipping", { pendingOrderId, paymentIntentId, status: p.status });
    return;
  }

  const event = await getEventById(p.event_id);
  if (!event) {
    console.warn("fulfillPaidOrder: event missing", { pendingOrderId, eventId: p.event_id });
    return;
  }

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
    discount_cents: p.discount_cents ?? 0,
    fee_cents: p.application_fee_cents,
    total_cents: p.total_cents,
    stripe_payment_intent_id: paymentIntentId,
    status: "paid",
    channel: "online",
    promo_code_id: p.promo_code_id ?? null,
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
  // Count the promo redemption.
  if (p.promo_code_id) await adjustPromoRedemption(p.promo_code_id, 1);

  await pendingRef.update({ status: "fulfilled", order_id: orderRef.id });

  // Deliver the ticket. Email is the reliable channel (Brevo is live); SMS is
  // best-effort and only really sends once Twilio creds land. Neither should
  // ever throw and undo a paid, fulfilled order.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const ticketUrl = `${site}/t/${orderRef.id}`;
  const whenText = new Date(event.starts_at).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  try {
    if (p.buyer.email) {
      await sendTicketEmail({
        to: p.buyer.email,
        firstName: p.buyer.first_name,
        eventTitle: event.title,
        whenText,
        venue: [event.venue_name, event.venue_address].filter(Boolean).join(" · "),
        quantity: p.quantity,
        ticketUrl,
      });
    }
  } catch (err) {
    console.error("ticket email error", err);
  }
  try {
    await sendSMS({
      to: p.buyer.phone,
      body: `You’re in — ${p.quantity} ticket${p.quantity > 1 ? "s" : ""} for ${event.title}. ${ticketUrl}`,
    });
  } catch (err) {
    console.error("ticket sms error", err);
  }
}

/** Release the hold when a PaymentIntent is canceled (or a hold has expired). */
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

export type SweepCounts = {
  scanned: number;
  fulfilled: number;
  released: number;
  kept: number;
  errors: number;
  // Surfaced in the endpoint response so an admin can see *which* holds failed
  // and why without needing server logs.
  problems: { pending: string; pi: string | null; error: string }[];
};

/**
 * Sweep abandoned holds: pending orders still "reserved" past their expires_at.
 *
 * Naively releasing them would recreate the decline-then-retry bug in another
 * costume — a hold can expire while the buyer is still paying. So every expired
 * hold is reconciled against Stripe first:
 *   succeeded  → fulfil it (they paid; the ticket must exist)
 *   processing → keep it (money in flight)
 *   otherwise  → cancel the PaymentIntent, so a late payment can't land on a
 *                hold we've given back, THEN release the inventory
 *
 * Scoped to one event when called before a new reservation (the only moment an
 * abandoned hold actually hurts); unscoped from the cron/admin backstop. The
 * query is equality-only (status, event_id) so it needs no composite index;
 * expiry is filtered in code — the "reserved" set is just live + abandoned
 * checkouts, so it stays small.
 */
export async function sweepExpiredHolds(opts: { eventId?: string; limit?: number } = {}): Promise<SweepCounts> {
  const db = getDb();
  const stripe = getStripe();
  const now = Date.now();
  const counts: SweepCounts = { scanned: 0, fulfilled: 0, released: 0, kept: 0, errors: 0, problems: [] };

  let q: FirebaseFirestore.Query = db.collection("pending_orders").where("status", "==", "reserved");
  if (opts.eventId) q = q.where("event_id", "==", opts.eventId);
  const snap = await q.limit(opts.limit ?? 200).get();

  for (const doc of snap.docs) {
    const p = doc.data();
    if (typeof p.expires_at !== "number" || p.expires_at > now) continue; // still live
    counts.scanned++;
    const pi: string | undefined = p.payment_intent_id;
    try {
      let status: string | null = null;
      if (pi) {
        try {
          status = (await stripe.paymentIntents.retrieve(pi)).status;
        } catch (err) {
          if ((err as { code?: string }).code !== "resource_missing") throw err;
          // The PI doesn't exist on this Stripe account / mode — e.g. a hold
          // created before the account swap, or in sandbox. It can never be
          // paid here, so the hold is safe to release; nothing to cancel.
          console.warn("sweepExpiredHolds: PI not found on this account, releasing hold", { pending: doc.id, pi });
          status = "missing";
        }
      }

      if (status === "succeeded") {
        await fulfillPaidOrder(doc.id, pi!);
        counts.fulfilled++;
        continue;
      }
      if (status === "processing") {
        counts.kept++;
        continue;
      }
      if (pi && status && status !== "canceled" && status !== "missing") {
        try {
          await stripe.paymentIntents.cancel(pi);
        } catch (err) {
          // Raced to succeeded/processing between retrieve and cancel — keep
          // the hold; the next sweep (or the webhook) will fulfil it.
          console.warn("sweepExpiredHolds: cancel refused, keeping hold", { pending: doc.id, pi, err: (err as Error).message });
          counts.kept++;
          continue;
        }
      }
      await releaseHold(doc.id);
      counts.released++;
    } catch (err) {
      counts.errors++;
      counts.problems.push({ pending: doc.id, pi: pi ?? null, error: (err as Error).message });
      console.error("sweepExpiredHolds error", { pending: doc.id, pi }, err);
    }
  }
  return counts;
}
