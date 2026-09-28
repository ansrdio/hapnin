// Finding 1: a paid order must never exist without its tickets, and a crash
// at any point must leave something the next attempt (webhook retry, the
// confirmation page's reconcile, or the sweeper) can finish.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { resetDb, seedEvent, seedPendingOrder, installFakeStripe, countWhere, data } from "./helpers";
import { getDb } from "../../lib/firebase-admin";
import { armFault } from "../../lib/faults";
import { fulfillPaidOrder, sweepExpiredHolds, fulfilmentState } from "../../lib/checkout";

beforeEach(async () => {
  await resetDb();
  installFakeStripe();
});

async function setup(qty = 2) {
  const s = await seedEvent();
  const pi = `pi_test${Math.random().toString(36).slice(2, 14)}`;
  const pendingId = await seedPendingOrder({ eventId: s.event.id, tierId: s.tierId, organizerId: s.organizer.id, quantity: qty, priceCents: 2500, pi });
  return { ...s, pi, pendingId };
}

test("fulfilment writes the order, every ticket and the counters together", async () => {
  const { event, pi, pendingId } = await setup(3);
  const orderId = await fulfillPaidOrder(pendingId, pi);
  assert.ok(orderId);
  assert.equal(await countWhere("tickets", "order_id", orderId), 3);
  const ev = await data(`events/${event.id}`);
  assert.equal(ev?.tickets_sold, 3);
  assert.equal(ev?.gross_cents, 7500);
  assert.equal((await data(`pending_orders/${pendingId}`))?.status, "fulfilled");
  const state = await fulfilmentState(pi);
  assert.equal(state.complete, true);
});

test("a crash right after the claim leaves no partial order, and the sweeper finishes it", async () => {
  const { event, pi, pendingId } = await setup(2);
  armFault("fulfil:after-claim");
  await assert.rejects(fulfillPaidOrder(pendingId, pi));

  assert.equal(await countWhere("orders", "stripe_payment_intent_id", pi), 0, "no order without tickets");
  assert.equal((await data(`pending_orders/${pendingId}`))?.status, "fulfilling");
  assert.equal((await fulfilmentState(pi)).complete, false);

  // The claim goes stale (the crashed attempt never comes back) → the sweeper retries.
  await getDb().collection("pending_orders").doc(pendingId).update({ fulfilling_at: Date.now() - 10 * 60 * 1000 });
  await sweepExpiredHolds({ eventId: event.id });

  const orders = await getDb().collection("orders").where("stripe_payment_intent_id", "==", pi).get();
  assert.equal(orders.size, 1);
  assert.equal(await countWhere("tickets", "order_id", orders.docs[0].id), 2);
  assert.equal((await data(`events/${event.id}`))?.tickets_sold, 2);
});

test("a crash inside the commit writes nothing at all", async () => {
  const { event, pi, pendingId } = await setup(2);
  armFault("fulfil:in-commit");
  await assert.rejects(fulfillPaidOrder(pendingId, pi));
  assert.equal(await countWhere("orders", "stripe_payment_intent_id", pi), 0);
  assert.equal(await countWhere("tickets", "event_id", event.id), 0);
  assert.equal((await data(`events/${event.id}`))?.tickets_sold ?? 0, 0);
});

test("concurrent fulfilment of the same payment produces exactly one order", async () => {
  const { pi, pendingId, event } = await setup(2);
  const results = await Promise.allSettled([fulfillPaidOrder(pendingId, pi), fulfillPaidOrder(pendingId, pi), fulfillPaidOrder(pendingId, pi)]);
  assert.ok(results.some((r) => r.status === "fulfilled" && r.value));
  assert.equal(await countWhere("orders", "stripe_payment_intent_id", pi), 1);
  assert.equal(await countWhere("tickets", "event_id", event.id), 2);
  assert.equal((await data(`events/${event.id}`))?.tickets_sold, 2);
});

test("an order left without tickets by older code is repaired, not reported as done", async () => {
  const { event, pi, pendingId, tierId } = await setup(2);
  // What the old code could leave behind: order written, pending claimed, no tickets, no counters.
  const orderRef = getDb().collection("orders").doc();
  await orderRef.set({
    event_id: event.id, buyer_id: "+16025550142", tier_id: tierId, quantity: 2, subtotal_cents: 5000, discount_cents: 0,
    fee_cents: 250, total_cents: 5205, stripe_payment_intent_id: pi, status: "paid", channel: "online", created_at: Timestamp.now(),
  });
  await getDb().collection("pending_orders").doc(pendingId).update({ status: "fulfilling", fulfilling_at: Date.now() - 10 * 60 * 1000 });

  assert.equal((await fulfilmentState(pi)).complete, false, "missing tickets means not ready");
  const id = await fulfillPaidOrder(pendingId, pi);
  assert.equal(id, orderRef.id);
  assert.equal(await countWhere("tickets", "order_id", orderRef.id), 2);
  assert.equal((await data(`events/${event.id}`))?.tickets_sold, 2);
  assert.equal((await fulfilmentState(pi)).complete, true);
});
