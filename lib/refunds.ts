import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getStripe } from "./stripe";
import { releaseInventory } from "./events";

/**
 * Full refund of an order. For online orders this refunds the PaymentIntent and,
 * because it's a destination charge, also reverses the transfer to the connected
 * account and refunds the platform application fee — so everyone nets back to
 * zero. Then it voids the tickets (scanner rejects them), returns the held
 * inventory, and reverses the event counters. Comps skip Stripe. Idempotent.
 */
export async function refundOrder(eventId: string, orderId: string): Promise<void> {
  const db = getDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new Error("ORDER_NOT_FOUND");
  const o = snap.data()!;
  if (o.event_id !== eventId) throw new Error("WRONG_EVENT");
  if (o.status === "refunded") return; // already done
  if (o.status !== "paid") throw new Error("NOT_REFUNDABLE");

  const qty = o.quantity ?? 0;

  // Money reversal — skip for comps / anything without a charge.
  if (o.channel !== "comp" && o.stripe_payment_intent_id) {
    await getStripe().refunds.create(
      {
        payment_intent: o.stripe_payment_intent_id as string,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: `refund_${orderId}` }
    );
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

  // Return inventory + reverse the event counters.
  await releaseInventory(eventId, o.tier_id, qty);
  const eventUpdate: Record<string, unknown> = { tickets_sold: FieldValue.increment(-qty) };
  if (o.channel !== "comp") eventUpdate.gross_cents = FieldValue.increment(-(o.subtotal_cents ?? 0));
  if (wereCheckedIn > 0) eventUpdate.checked_in = FieldValue.increment(-wereCheckedIn);
  await db.collection("events").doc(eventId).update(eventUpdate);
}
