// Finding 3 (concurrency half) and the door: two requests racing for the same
// tickets, and two door staff checking in the same party.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedEvent, seedPendingOrder, installFakeStripe, data } from "./helpers";
import { getDb } from "../../lib/firebase-admin";
import { fulfillPaidOrder } from "../../lib/checkout";
import { transferTickets } from "../../lib/transfers";
import { checkInOrder } from "../../lib/orders";

beforeEach(async () => {
  await resetDb();
  installFakeStripe();
});

async function paidOrder(qty: number, opts: { is_sample?: boolean } = {}) {
  const s = await seedEvent({ is_sample: opts.is_sample });
  const pi = `pi_test${Math.random().toString(36).slice(2, 14)}`;
  const pendingId = await seedPendingOrder({ eventId: s.event.id, tierId: s.tierId, organizerId: s.organizer.id, quantity: qty, priceCents: 2500, pi });
  const orderId = (await fulfillPaidOrder(pendingId, pi))!;
  return { ...s, orderId };
}

test("two transfers racing for the same tickets never move more than exist", async () => {
  const { event, orderId } = await paidOrder(2);
  const results = await Promise.allSettled([
    transferTickets({ orderId, count: 2, recipient: { phone: "+16025550181" } }),
    transferTickets({ orderId, count: 2, recipient: { phone: "+16025550182" } }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "only one can take both tickets");
  const tickets = await getDb().collection("tickets").where("event_id", "==", event.id).get();
  assert.equal(tickets.size, 2);
  const owners = new Set(tickets.docs.map((t) => t.data().order_id));
  assert.equal(owners.size, 1, "both tickets went to one recipient order");
  assert.ok(!owners.has(orderId));
});

test("a transfer keeps the purchase link and never changes the money on the original", async () => {
  const { orderId } = await paidOrder(3);
  const { newOrderId } = await transferTickets({ orderId, count: 1, recipient: { phone: "+16025550183" } });
  const orig = await data(`orders/${orderId}`);
  const moved = await data(`orders/${newOrderId}`);
  assert.equal(orig?.status, "paid");
  assert.equal(orig?.subtotal_cents, 7500);
  assert.equal(orig?.quantity, 2, "currently held");
  assert.equal(moved?.purchase_order_id, orderId);
  const t = await getDb().collection("tickets").where("order_id", "==", newOrderId).get();
  assert.equal(t.docs[0].data().purchase_order_id, orderId);
});

test("a transfer out of a demo purchase stays demo data", async () => {
  const { orderId } = await paidOrder(2, { is_sample: true });
  const { newOrderId } = await transferTickets({ orderId, count: 1, recipient: { phone: "+16025550184" } });
  assert.equal((await data(`orders/${newOrderId}`))?.is_sample, true);
  assert.equal((await data(`buyers/+16025550184`))?.is_sample, true, "a buyer created by a demo transfer is flagged");
});

test("two door staff checking in the same party count each person once", async () => {
  const { event, orderId } = await paidOrder(3);
  const results = await Promise.all([checkInOrder(event.id, orderId, "door-a"), checkInOrder(event.id, orderId, "door-b")]);
  assert.equal(results[0] + results[1], 3);
  assert.equal((await data(`events/${event.id}`))?.checked_in, 3);
});
