import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getStripe } from "./stripe";
import { getEventById, getTier, releaseInventory } from "./events";
import { notifyWaitlist } from "./waitlist";
import { adjustPromoterStats } from "./promoters";
import { adjustPromoRedemption } from "./promos";
import { sendRefundEmail } from "./email";
import { sendSMS } from "./sms";

/**
 * Full refund of an order. For online orders this refunds the PaymentIntent and,
 * because it's a destination charge, also reverses the transfer to the connected
 * account (and the platform fee, when one was charged) — so everyone nets back
 * to zero. Then it voids the tickets (scanner rejects them), returns the held
 * inventory, reverses the event counters, and tells the buyer. Comps skip Stripe.
 *
 * Exactly-once: the order is CLAIMED paid→"refunding" in a transaction before
 * anything else, so a double click or two concurrent requests can't both
 * reverse inventory and counters. If Stripe refuses, the claim is released so
 * the organizer can retry.
 */
export async function refundOrder(eventId: string, orderId: string): Promise<void> {
  const db = getDb();
  const orderRef = db.collection("orders").doc(orderId);

  const o = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new Error("ORDER_NOT_FOUND");
    const d = snap.data()!;
    if (d.event_id !== eventId) throw new Error("WRONG_EVENT");
    if (d.status === "refunded" || d.status === "refunding") return null; // done / in progress elsewhere
    if (d.status !== "paid") throw new Error("NOT_REFUNDABLE");
    tx.update(orderRef, { status: "refunding" });
    return d;
  });
  if (!o) return;

  const qty = o.quantity ?? 0;

  // Money reversal — skip for comps / anything without a charge.
  if (o.channel !== "comp" && o.stripe_payment_intent_id) {
    // Only refund the application fee if one was actually charged. First/launch
    // events carry no platform fee (fee_cents === 0); asking Stripe to refund a
    // non-existent application fee is a 400. reverse_transfer always applies —
    // it claws the funds back from the organizer's connected account.
    const hadFee = (o.fee_cents ?? 0) > 0;
    try {
      await getStripe().refunds.create(
        {
          payment_intent: o.stripe_payment_intent_id as string,
          reverse_transfer: true,
          ...(hadFee ? { refund_application_fee: true } : {}),
        },
        // v2: the original `refund_${orderId}` key cached a pre-fix 400 in
        // Stripe; bumped so corrected requests aren't replayed as that error.
        { idempotencyKey: `refund_${orderId}_v2` }
      );
    } catch (err) {
      // Give the claim back so the organizer can retry once the cause is fixed
      // (e.g. an insufficient platform balance).
      await orderRef.update({ status: "paid" }).catch(() => {});
      throw err;
    }
  }

  await orderRef.update({ status: "refunded", refunded_at: FieldValue.serverTimestamp() });

  // Void tickets so the door scanner rejects them; note any already checked in.
  const tickets = await db.collection("tickets").where("order_id", "==", orderId).get();
  let wereCheckedIn = 0;
  const batch = db.batch();
  for (const t of tickets.docs) {
    if (t.data().checked_in_at) wereCheckedIn++;
    batch.update(t.ref, { voided_at: FieldValue.serverTimestamp() });
  }
  if (!tickets.empty) await batch.commit();

  // Return inventory + reverse the event counters. Note whether the tier was
  // full first — a refund on a full tier is what the waitlist is waiting for.
  const tierBefore = await getTier(eventId, o.tier_id);
  const wasFull = !!tierBefore && tierBefore.quantity_sold >= tierBefore.quantity_total;
  await releaseInventory(eventId, o.tier_id, qty);
  const eventUpdate: Record<string, unknown> = { tickets_sold: FieldValue.increment(-qty) };
  if (o.channel !== "comp") eventUpdate.gross_cents = FieldValue.increment(-(o.subtotal_cents ?? 0));
  if (wereCheckedIn > 0) eventUpdate.checked_in = FieldValue.increment(-wereCheckedIn);
  await db.collection("events").doc(eventId).update(eventUpdate);

  // Seats just freed on a full tier → tell the waitlist automatically.
  // Best-effort; notifyWaitlist de-dupes to once per person per 24h.
  if (wasFull) {
    try {
      await notifyWaitlist(eventId);
    } catch (err) {
      console.error("waitlist auto-notify error", { eventId }, err);
    }
  }

  // Reverse promoter attribution.
  if (o.promoter_link_id) {
    await adjustPromoterStats(o.promoter_link_id, { orders: -1, tickets: -qty, gross: -(o.subtotal_cents ?? 0) });
  }
  // Return the promo redemption.
  if (o.promo_code_id) await adjustPromoRedemption(o.promo_code_id, -1);

  // Tell the buyer. Best-effort — a notification failure never undoes a
  // completed refund. Buyers are keyed by phone (order.buyer_id).
  if (o.channel !== "comp") {
    try {
      const [event, buyer] = await Promise.all([
        getEventById(eventId),
        db.collection("buyers").doc(String(o.buyer_id)).get(),
      ]);
      const b = buyer.exists ? buyer.data()! : null;
      const amountCents = o.total_cents ?? 0;
      if (event && b?.email) {
        await sendRefundEmail({ to: b.email, firstName: b.first_name ?? null, eventTitle: event.title, amountCents });
      }
      if (event && o.buyer_id) {
        await sendSMS({
          to: String(o.buyer_id),
          body: `Refund issued — ${event.title}: $${(amountCents / 100).toFixed(2)} returns to your card in 5–10 business days.`,
        });
      }
    } catch (err) {
      console.error("refund notify error", { orderId }, err);
    }
  }
}
