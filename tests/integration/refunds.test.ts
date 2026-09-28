// Findings 2 and 3: a refund must end with tickets voided and inventory back,
// even across a crash, and must cover tickets that were transferred to friends.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedEvent, seedPendingOrder, installFakeStripe, countWhere, data, type FakeStripe } from "./helpers";
import { getDb } from "../../lib/firebase-admin";
import { armFault } from "../../lib/faults";
import { fulfillPaidOrder } from "../../lib/checkout";
import { refundOrder } from "../../lib/refunds";
import { transferTickets } from "../../lib/transfers";

let stripe: FakeStripe;
beforeEach(async () => {
  await resetDb();
  stripe = installFakeStripe();
});

async function paidOrder(qty = 2) {
  const s = await seedEvent();
  const pi = `pi_test${Math.random().toString(36).slice(2, 14)}`;
  const pendingId = await seedPendingOrder({ eventId: s.event.id, tierId: s.tierId, organizerId: s.organizer.id, quantity: qty, priceCents: 2500, pi });
  const orderId = (await fulfillPaidOrder(pendingId, pi))!;
  return { ...s, pi, orderId };
}

async function liveTickets(eventId: string) {
  const snap = await getDb().collection("tickets").where("event_id", "==", eventId).get();
  return snap.docs.filter((d) => !d.data().voided_at).length;
}

test("refund voids every ticket, returns the inventory and reverses the counters", async () => {
  const { event, tierId, orderId } = await paidOrder(2);
  await refundOrder(event.id, orderId);
  assert.equal((await data(`orders/${orderId}`))?.status, "refunded");
  assert.equal(await liveTickets(event.id), 0);
  assert.equal((await data(`events/${event.id}/tiers/${tierId}`))?.quantity_sold, 0);
  assert.equal((await data(`events/${event.id}`))?.tickets_sold, 0);
  assert.equal(stripe.calls.filter((c) => c.method === "refunds.create").length, 1);
});

test("Stripe refusing leaves the order paid and every ticket valid", async () => {
  const { event, orderId } = await paidOrder(2);
  stripe.refundFailures = 1;
  await assert.rejects(refundOrder(event.id, orderId));
  assert.equal((await data(`orders/${orderId}`))?.status, "paid");
  assert.equal(await liveTickets(event.id), 2);
});

test("a crash after Stripe refunded is finished by the next attempt, with the same idempotency key", async () => {
  const { event, tierId, orderId } = await paidOrder(2);
  armFault("refund:after-stripe");
  await assert.rejects(refundOrder(event.id, orderId));
  assert.equal((await data(`orders/${orderId}`))?.status, "refunding");
  assert.equal(await liveTickets(event.id), 2, "nothing half-voided");

  await getDb().collection("orders").doc(orderId).update({ refund_started_at: Date.now() - 10 * 60 * 1000 });
  await refundOrder(event.id, orderId);

  assert.equal((await data(`orders/${orderId}`))?.status, "refunded");
  assert.equal(await liveTickets(event.id), 0);
  assert.equal((await data(`events/${event.id}/tiers/${tierId}`))?.quantity_sold, 0, "inventory released exactly once");
  const keys = stripe.calls.filter((c) => c.method === "refunds.create").map((c) => (c.args[1] as { idempotencyKey: string }).idempotencyKey);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test("a crash before Stripe was called does not strand the order in refunding", async () => {
  const { event, orderId } = await paidOrder(1);
  armFault("refund:after-claim");
  await assert.rejects(refundOrder(event.id, orderId));
  assert.equal((await data(`orders/${orderId}`))?.status, "refunding");
  await getDb().collection("orders").doc(orderId).update({ refund_started_at: Date.now() - 10 * 60 * 1000 });
  await refundOrder(event.id, orderId);
  assert.equal((await data(`orders/${orderId}`))?.status, "refunded");
  assert.equal(await liveTickets(event.id), 0);
});

test("a refund already in progress elsewhere is not run twice", async () => {
  const { event, tierId, orderId } = await paidOrder(2);
  await Promise.allSettled([refundOrder(event.id, orderId), refundOrder(event.id, orderId)]);
  assert.equal(stripe.calls.filter((c) => c.method === "refunds.create").length, 1);
  assert.equal((await data(`events/${event.id}/tiers/${tierId}`))?.quantity_sold, 0);
});

test("refunding a purchase voids the ticket that was transferred to a friend", async () => {
  const { event, tierId, orderId } = await paidOrder(2);
  const { newOrderId } = await transferTickets({ orderId, count: 1, recipient: { phone: "+16025550199", first_name: "Friend" } });
  const before = await data(`orders/${orderId}`);
  assert.equal(before?.subtotal_cents, 5000, "the original purchase keeps its full amount");

  await refundOrder(event.id, orderId);
  assert.equal(await liveTickets(event.id), 0, "the friend's ticket is void too");
  assert.equal((await data(`orders/${newOrderId}`))?.status, "refunded");
  assert.equal((await data(`events/${event.id}/tiers/${tierId}`))?.quantity_sold, 0, "both seats back");
  assert.equal((await data(`events/${event.id}`))?.tickets_sold, 0);
});

test("a purchase whose tickets were all transferred can still be refunded", async () => {
  const { event, orderId } = await paidOrder(1);
  await transferTickets({ orderId, count: 1, recipient: { phone: "+16025550198" } });
  await refundOrder(event.id, orderId);
  assert.equal((await data(`orders/${orderId}`))?.status, "refunded");
  assert.equal(await liveTickets(event.id), 0);
});

test("a refunded ticket can't be transferred", async () => {
  const { event, orderId } = await paidOrder(2);
  await refundOrder(event.id, orderId);
  await assert.rejects(transferTickets({ orderId, count: 1, recipient: { phone: "+16025550197" } }));
  assert.equal(await countWhere("orders", "channel", "transfer"), 0);
});
