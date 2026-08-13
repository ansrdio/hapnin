import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEventById, getTier, reserveInventory, releaseInventory } from "./events";
import { findOrCreateBuyer } from "./buyers";
import { qrToken } from "./qr";
import { sendSMS } from "./sms";

export const COMP_MAX_QTY = 20;

/**
 * Issue comp (free) tickets — guest list, press, artist plus-ones. Mirrors a paid
 * order but at $0: reserves tier inventory (so comps can't oversell), creates a
 * channel="comp" order and one is_comp ticket per admission with a signed QR, and
 * bumps tickets_sold (NOT gross). Texts the ticket link. Throws "SOLD_OUT" if the
 * tier can't fit the quantity.
 */
export async function issueComp(input: {
  eventId: string;
  tierId: string;
  quantity: number;
  buyer: { phone: string; first_name: string; last_name: string; email?: string | null };
  note?: string | null;
}): Promise<{ orderId: string }> {
  const db = getDb();

  const event = await getEventById(input.eventId);
  if (!event) throw new Error("EVENT_NOT_FOUND");
  const tier = await getTier(input.eventId, input.tierId);
  if (!tier) throw new Error("TIER_NOT_FOUND");

  const qty = Math.max(1, Math.min(COMP_MAX_QTY, Math.floor(input.quantity)));
  await reserveInventory(input.eventId, input.tierId, qty); // respects capacity; throws SOLD_OUT

  try {
    await findOrCreateBuyer({
      phone: input.buyer.phone,
      email: input.buyer.email ?? null,
      first_name: input.buyer.first_name,
      last_name: input.buyer.last_name,
      postal_code: "",
      first_event_id: input.eventId,
    });

    const daysBefore = Math.max(0, Math.ceil((event.starts_at - Date.now()) / 86_400_000));

    const orderRef = db.collection("orders").doc();
    await orderRef.set({
      event_id: input.eventId,
      buyer_id: input.buyer.phone,
      tier_id: input.tierId,
      quantity: qty,
      subtotal_cents: 0,
      fee_cents: 0,
      total_cents: 0,
      stripe_payment_intent_id: null,
      status: "paid",
      channel: "comp",
      note: input.note ?? null,
      days_before_event: daysBefore,
      referral_source: null,
      promoter_link_id: null,
      created_at: FieldValue.serverTimestamp(),
    });

    const batch = db.batch();
    for (let i = 0; i < qty; i++) {
      const tRef = db.collection("tickets").doc();
      batch.set(tRef, {
        order_id: orderRef.id,
        event_id: input.eventId,
        buyer_id: input.buyer.phone,
        qr_token: qrToken(tRef.id),
        is_comp: true,
        checked_in_at: null,
        checked_in_by: null,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    // Comps occupy capacity (tickets_sold) but never touch gross.
    await db.collection("events").doc(input.eventId).update({
      tickets_sold: FieldValue.increment(qty),
    });

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
    await sendSMS({
      to: input.buyer.phone,
      body: `You’re on the list — ${qty} ${qty > 1 ? "passes" : "pass"} for ${event.title}. ${site}/t/${orderRef.id}`,
    });

    return { orderId: orderRef.id };
  } catch (err) {
    await releaseInventory(input.eventId, input.tierId, qty);
    throw err;
  }
}
