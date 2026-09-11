import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getStripe } from "./stripe";
import { getEventById, getEventBySlug, getTier, reserveInventory, releaseInventory } from "./events";
import { getOrganizerById, isFeeWaived } from "./organizers";
import { findOrCreateBuyer, recordConsent } from "./buyers";
import { resolvePromoterCode, adjustPromoterStats } from "./promoters";
import { resolvePromo, promoDiscountCents, adjustPromoRedemption } from "./promos";
import { qrToken } from "./qr";
import { sendSMS } from "./sms";
import { sendTicketEmail, sendReferralJoinedEmail } from "./email";
import { transferTickets } from "./transfers";

// ── Money ────────────────────────────────────────────────────────────────────
// Every amount is computed HERE, server-side, from the tier price in Firestore —
// never trusted from the client. Model (see docs/architecture.md):
//   buyer pays  = face value + card processing (buyers cover card fees)
//   organizer nets ≈ face value (Stripe fee is covered by the added card fee)
//   Hapnin keeps = application_fee_amount (0 while an organizer's launch-offer
//                  fee waiver is active — see organizers.isFeeWaived)
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

export function computeAmounts(priceCents: number, qty: number, feeWaived: boolean, discountCents = 0): Amounts {
  const gross = priceCents * qty;
  const discount = Math.max(0, Math.min(discountCents, gross));
  const subtotal = gross - discount;
  // A free ticket carries no fees at all — nothing is charged.
  if (subtotal === 0) {
    return { subtotal_cents: 0, discount_cents: discount, card_fee_cents: 0, application_fee_cents: 0, total_cents: 0 };
  }
  const card = Math.round(subtotal * CARD.pct + CARD.fixed * qty);
  const application = feeWaived ? 0 : Math.round(subtotal * PLATFORM.pct + PLATFORM.fixed * qty);
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
    show_name: boolean; // may their first name appear in "X, Y and N others going"
  };
  referral_source: string | null;
  promoter_code: string | null;
  promo_code: string | null;
  /** Bring-a-friend: another buyer's share code for this event (a bad one is ignored). */
  friend_code: string | null;
  /** Group buying: named friends who each get one ticket transferred to them on payment. */
  friends: { first_name: string; phone: string; email: string | null }[];
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
  const promoDiscount = promo ? promoDiscountCents(promo, tier.price_cents * qty) : 0;

  // Bring-a-friend: a valid share code — someone ELSE's paid order on this
  // event — is worth the organizer's flat referral_off_cents. A bad or
  // self-referring code is simply ignored. Not stackable with a promo: the
  // larger discount wins and only that one is recorded.
  let referrer: { id: string } | null = null;
  if (input.friend_code && event.referral_off_cents > 0) {
    const snap = await db.collection("orders").where("ref_code", "==", input.friend_code).limit(1).get();
    const d = snap.empty ? null : snap.docs[0].data();
    if (d && d.event_id === event.id && d.status === "paid" && d.buyer_id !== input.buyer.phone) {
      referrer = { id: snap.docs[0].id };
    }
  }
  const referralDiscount = referrer ? Math.min(event.referral_off_cents, tier.price_cents * qty) : 0;
  const referralWins = referralDiscount > promoDiscount;
  const discount = referralWins ? referralDiscount : promoDiscount;
  const amounts = computeAmounts(tier.price_cents, qty, isFeeWaived(organizer), discount);

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
      // 0 while the organizer's fee waiver is active → omit so the full amount transfers to them.
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
      promo_code_id: referralWins ? null : (promo?.id ?? null),
      referred_by_order_id: referralWins && referrer ? referrer.id : null,
      friends: input.friends ?? [],
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

  // CLAIM the pending order in one transaction. Fulfilment can now be
  // triggered by the webhook, the confirmation page's reconcile, and the
  // sweeper at the same time; without a lock two of them could each create an
  // order (duplicate tickets). Only the caller that flips reserved→fulfilling
  // proceeds. A claim older than CLAIM_STALE_MS is treated as a crashed
  // attempt and may be re-taken (the order-exists guard above prevents dupes).
  //
  // The claim also handles a hold that a payment_failed webhook released: a
  // PaymentIntent can fail once and succeed on retry (declined card, Apple Pay
  // re-tap), and the money has still been captured by the time we're here —
  // so re-take the inventory in the SAME transaction, or give up loudly if the
  // tier sold out in the gap (that one needs a refund).
  const CLAIM_STALE_MS = 2 * 60 * 1000;
  type Claim = { ok: true; p: FirebaseFirestore.DocumentData } | { ok: false; reason: string; quiet?: boolean };
  let claim: Claim;
  try {
    claim = await db.runTransaction<Claim>(async (tx) => {
      const snap = await tx.get(pendingRef);
      if (!snap.exists) return { ok: false, reason: "pending order missing" };
      const p = snap.data()!;
      if (p.status === "fulfilled") return { ok: false, reason: "already fulfilled", quiet: true };
      if (p.status === "fulfilling" && Date.now() - (p.fulfilling_at ?? 0) < CLAIM_STALE_MS) {
        return { ok: false, reason: "fulfilment in progress elsewhere", quiet: true };
      }
      if (p.status === "released") {
        const tierRef = db.collection("events").doc(p.event_id).collection("tiers").doc(p.tier_id);
        const tier = await tx.get(tierRef); // reads before writes
        if (!tier.exists) throw new Error("TIER_NOT_FOUND");
        const d = tier.data()!;
        const sold = d.quantity_sold ?? 0;
        if (d.is_active === false || sold + p.quantity > d.quantity_total) throw new Error("SOLD_OUT");
        tx.update(tierRef, { quantity_sold: sold + p.quantity });
      } else if (p.status !== "reserved" && p.status !== "fulfilling") {
        return { ok: false, reason: `unexpected status ${p.status}` };
      }
      tx.update(pendingRef, { status: "fulfilling", fulfilling_at: Date.now() });
      return { ok: true, p };
    });
  } catch (err) {
    console.error("fulfillPaidOrder: PAID BUT SOLD OUT — needs refund", { pendingOrderId, paymentIntentId, err });
    return;
  }
  if (!claim.ok) {
    // Silent no-ops still return 200 to the webhook, so log the non-benign ones.
    if (!claim.quiet) console.warn("fulfillPaidOrder: skipping", { pendingOrderId, paymentIntentId, reason: claim.reason });
    return;
  }
  const p = claim.p;

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
    show_name: p.buyer.show_name !== false,
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
    // Bring-a-friend: this order's own share code, and who (if anyone) referred it.
    ref_code: Math.random().toString(36).slice(2, 10),
    referred_by_order_id: p.referred_by_order_id ?? null,
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

  // Group buying: hand each named friend their own ticket — a transfer into a
  // fresh order in their name (their QR stays valid) — then email it if we have
  // an address; transferTickets texts them. Best-effort per friend; a failure
  // leaves the ticket with the buyer and never undoes the order.
  const friends = (p.friends ?? []) as { first_name: string; phone: string; email: string | null }[];
  const seenPhones = new Set<string>([p.buyer.phone]);
  for (const f of friends) {
    if (!f.phone || seenPhones.has(f.phone)) continue;
    seenPhones.add(f.phone);
    try {
      const { newOrderId } = await transferTickets({
        orderId: orderRef.id,
        count: 1,
        recipient: { phone: f.phone, first_name: f.first_name, email: f.email },
      });
      if (f.email) {
        await sendTicketEmail({
          to: f.email,
          firstName: f.first_name,
          eventTitle: event.title,
          whenText,
          venue: [event.venue_name, event.venue_address].filter(Boolean).join(" · "),
          quantity: 1,
          ticketUrl: `${site}/t/${newOrderId}`,
        });
      }
    } catch (err) {
      console.error("group ticket error", { orderId: orderRef.id, phone: f.phone }, err);
    }
  }

  // Bring-a-friend: tell the referrer someone joined through their link.
  if (p.referred_by_order_id) {
    try {
      const refOrder = await db.collection("orders").doc(p.referred_by_order_id).get();
      const refBuyer = refOrder.exists ? await db.collection("buyers").doc(refOrder.data()!.buyer_id).get() : null;
      const email = refBuyer?.exists ? ((refBuyer.data()!.email as string | null) ?? null) : null;
      if (email) {
        const count = (await db.collection("orders").where("referred_by_order_id", "==", p.referred_by_order_id).get()).size;
        await sendReferralJoinedEmail({
          to: email,
          firstName: (refBuyer!.data()!.first_name as string | null) ?? null,
          friendFirstName: p.buyer.first_name,
          eventTitle: event.title,
          count,
          ticketUrl: `${site}/t/${p.referred_by_order_id}`,
        });
      }
    } catch (err) {
      console.error("referral notify error", { orderId: orderRef.id }, err);
    }
  }
}

/**
 * Release the hold when a PaymentIntent is canceled (or a hold has expired).
 * Returns true if THIS call did the release.
 *
 * The "still reserved?" check, the inventory decrement, and the status flip
 * happen in ONE transaction. Done as three separate steps, two concurrent
 * releases (sweep + canceled-webhook, a webhook retry, a double click) both
 * passed the check and both decremented — that double-released a General
 * hold on Dance Sundays and left the tier under-counted by one.
 */
export async function releaseHold(pendingOrderId: string): Promise<boolean> {
  const db = getDb();
  const ref = db.collection("pending_orders").doc(pendingOrderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const p = snap.data()!;
    if (p.status !== "reserved") return false;
    const tierRef = db.collection("events").doc(p.event_id).collection("tiers").doc(p.tier_id);
    const tier = await tx.get(tierRef); // all reads before any write
    if (tier.exists) {
      const sold = tier.data()!.quantity_sold ?? 0;
      tx.update(tierRef, { quantity_sold: Math.max(0, sold - (p.quantity ?? 0)) });
    }
    tx.update(ref, { status: "released" });
    return true;
  });
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
      // Release FIRST, then cancel. Cancelling emits payment_intent.canceled,
      // whose webhook also calls releaseHold on this same hold ~1s later. With
      // the hold already released that's a guaranteed no-op; done the other way
      // round it's two releases racing on one tier's transaction — which
      // surfaced as spurious "errors" on the first production sweep.
      if (await releaseHold(doc.id)) counts.released++;
      else counts.kept++; // someone else released it first — nothing to do
      if (pi && status && status !== "canceled" && status !== "missing") {
        try {
          await stripe.paymentIntents.cancel(pi);
        } catch (err) {
          // The payment raced to succeeded/processing after we released. Safe:
          // the succeeded webhook / reconcile re-reserves a released hold and
          // fulfils it. Just make it visible.
          console.warn("sweepExpiredHolds: cancel refused after release (payment raced through?)", { pending: doc.id, pi, err: (err as Error).message });
        }
      }
    } catch (err) {
      counts.errors++;
      counts.problems.push({ pending: doc.id, pi: pi ?? null, error: (err as Error).message });
      console.error("sweepExpiredHolds error", { pending: doc.id, pi }, err);
    }
  }
  return counts;
}

/**
 * Re-send an existing ticket link to its buyer: email when we have an address
 * (the reliable channel until Twilio lands), SMS best-effort. Used by the guest
 * list's Resend button. Buyers are keyed by phone. Never throws.
 */
export async function deliverTicket(input: {
  orderId: string;
  quantity: number;
  phone: string;
  event: { title: string; starts_at: number; venue_name: string; venue_address: string };
}): Promise<{ emailed: boolean }> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const ticketUrl = `${site}/t/${input.orderId}`;
  let emailed = false;
  try {
    const buyer = await getDb().collection("buyers").doc(input.phone).get();
    const b = buyer.exists ? buyer.data()! : null;
    if (b?.email) {
      const r = await sendTicketEmail({
        to: b.email,
        firstName: b.first_name ?? undefined,
        eventTitle: input.event.title,
        whenText: new Date(input.event.starts_at).toLocaleString("en-US", {
          timeZone: "America/Phoenix", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        }),
        venue: [input.event.venue_name, input.event.venue_address].filter(Boolean).join(" · "),
        quantity: input.quantity,
        ticketUrl,
      });
      emailed = r.ok;
    }
  } catch (err) {
    console.error("deliverTicket email error", { orderId: input.orderId }, err);
  }
  try {
    await sendSMS({ to: input.phone, body: `Your ticket for ${input.event.title}: ${ticketUrl}` });
  } catch (err) {
    console.error("deliverTicket sms error", { orderId: input.orderId }, err);
  }
  return { emailed };
}
