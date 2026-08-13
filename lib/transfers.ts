import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { findOrCreateBuyer } from "./buyers";
import { sendSMS } from "./sms";

/**
 * Transfer N tickets from an order to another person by phone. The ticket link is
 * the bearer credential, so this is initiated from the ticket page. Moves the
 * tickets to a fresh channel="transfer" order owned by the recipient (their QR
 * stays valid — it's signed by the ticket's own id), shrinks the source order,
 * and texts the recipient their new link. Checked-in and voided tickets can't
 * move. No money changes hands and no counters shift (already counted).
 */
export async function transferTickets(input: {
  orderId: string;
  count: number;
  recipient: { phone: string; first_name?: string | null };
}): Promise<{ newOrderId: string }> {
  const db = getDb();
  const orderSnap = await db.collection("orders").doc(input.orderId).get();
  if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");
  const order = orderSnap.data()!;

  const ticketsSnap = await db.collection("tickets").where("order_id", "==", input.orderId).get();
  const movable = ticketsSnap.docs.filter((t) => !t.data().checked_in_at && !t.data().voided_at);

  const count = Math.floor(input.count);
  if (count < 1 || count > movable.length) throw new Error("TOO_MANY");

  await findOrCreateBuyer({
    phone: input.recipient.phone,
    first_name: input.recipient.first_name ?? null,
    postal_code: "",
    first_event_id: order.event_id,
  });

  const newOrderRef = db.collection("orders").doc();
  const selected = movable.slice(0, count);

  const batch = db.batch();
  batch.set(newOrderRef, {
    event_id: order.event_id,
    buyer_id: input.recipient.phone,
    tier_id: order.tier_id,
    quantity: count,
    subtotal_cents: 0,
    discount_cents: 0,
    fee_cents: 0,
    total_cents: 0,
    stripe_payment_intent_id: null,
    status: "paid",
    channel: "transfer",
    source_order_id: input.orderId,
    days_before_event: order.days_before_event ?? 0,
    referral_source: null,
    promoter_link_id: null,
    promo_code_id: null,
    created_at: FieldValue.serverTimestamp(),
  });

  for (const t of selected) {
    batch.update(t.ref, { order_id: newOrderRef.id, buyer_id: input.recipient.phone });
  }

  const remaining = (order.quantity ?? selected.length) - count;
  batch.update(orderSnap.ref, {
    quantity: remaining,
    ...(remaining <= 0 ? { status: "transferred" } : {}),
  });

  await batch.commit();

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  await sendSMS({
    to: input.recipient.phone,
    body: `You’ve been sent ${count} ${count > 1 ? "tickets" : "ticket"}. ${site}/t/${newOrderRef.id}`,
  });

  return { newOrderId: newOrderRef.id };
}
