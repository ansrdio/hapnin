import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEventById, getTier, reserveInventory, releaseInventory } from "./events";
import { findOrCreateBuyer } from "./buyers";
import { qrToken } from "./qr";
import { sendSMS } from "./sms";

export const DOOR_MAX_QTY = 20;
export type DoorPayment = "cash" | "card";

/**
 * Record a box-office (door) sale. The money is collected off-platform (cash or an
 * external card reader), so there's no Stripe charge — we record it as revenue,
 * reserve inventory, and issue scannable tickets. Phone is optional: with one we
 * text the ticket link; without, it's a walk-in and the QR lives at /t/{orderId}.
 * Counts toward tickets_sold and gross. Throws "SOLD_OUT" if it can't fit.
 */
export async function sellAtDoor(input: {
  eventId: string;
  tierId: string;
  quantity: number;
  payment: DoorPayment;
  buyer?: { phone?: string | null; first_name?: string | null; last_name?: string | null };
  byId: string;
}): Promise<{ orderId: string }> {
  const db = getDb();
  const event = await getEventById(input.eventId);
  if (!event) throw new Error("EVENT_NOT_FOUND");
  const tier = await getTier(input.eventId, input.tierId);
  if (!tier) throw new Error("TIER_NOT_FOUND");

  const qty = Math.max(1, Math.min(DOOR_MAX_QTY, Math.floor(input.quantity)));
  await reserveInventory(input.eventId, input.tierId, qty); // throws SOLD_OUT

  try {
    const subtotal = tier.price_cents * qty;
    const orderRef = db.collection("orders").doc();
    const phone = input.buyer?.phone || null;
    const buyerId = phone || `door-${orderRef.id}`;

    if (phone) {
      await findOrCreateBuyer({
        phone,
        first_name: input.buyer?.first_name ?? null,
        last_name: input.buyer?.last_name ?? null,
        postal_code: "",
        first_event_id: input.eventId,
      });
    }

    const daysBefore = Math.max(0, Math.ceil((event.starts_at - Date.now()) / 86_400_000));
    await orderRef.set({
      event_id: input.eventId,
      buyer_id: buyerId,
      tier_id: input.tierId,
      quantity: qty,
      subtotal_cents: subtotal,
      discount_cents: 0,
      fee_cents: 0,
      total_cents: subtotal,
      stripe_payment_intent_id: null,
      status: "paid",
      channel: "door",
      payment_method: input.payment,
      note: null,
      days_before_event: daysBefore,
      referral_source: null,
      promoter_link_id: null,
      promo_code_id: null,
      created_at: FieldValue.serverTimestamp(),
    });

    const batch = db.batch();
    for (let i = 0; i < qty; i++) {
      const tRef = db.collection("tickets").doc();
      batch.set(tRef, {
        order_id: orderRef.id,
        event_id: input.eventId,
        buyer_id: buyerId,
        qr_token: qrToken(tRef.id),
        is_comp: false,
        checked_in_at: null,
        checked_in_by: null,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    await db.collection("events").doc(input.eventId).update({
      tickets_sold: FieldValue.increment(qty),
      gross_cents: FieldValue.increment(subtotal),
    });

    if (phone) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
      await sendSMS({
        to: phone,
        body: `You’re in — ${qty} ${qty > 1 ? "tickets" : "ticket"} for ${event.title}. ${site}/t/${orderRef.id}`,
      });
    }

    return { orderId: orderRef.id };
  } catch (err) {
    await releaseInventory(input.eventId, input.tierId, qty);
    throw err;
  }
}
