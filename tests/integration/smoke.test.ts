import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedEvent, installFakeStripe, data } from "./helpers";

beforeEach(resetDb);

test("harness: real modules against the emulator", async () => {
  installFakeStripe();
  const { event, tierId } = await seedEvent();
  const tier = await data(`events/${event.id}/tiers/${tierId}`);
  assert.equal(tier?.quantity_total, 10);
  assert.equal(tier?.quantity_sold, 0);
});
