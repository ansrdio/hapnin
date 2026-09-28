// Finding 4: only "this event id already exists" means duplicate. Any other
// database error must surface, so Stripe retries instead of getting a 200.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";
import { claimWebhookEvent } from "../../lib/webhook-dedupe";

beforeEach(resetDb);

test("first delivery is new, a repeat is a duplicate", async () => {
  assert.equal(await claimWebhookEvent("evt_test_1"), "new");
  assert.equal(await claimWebhookEvent("evt_test_1"), "duplicate");
});

test("a database outage is an error, never a duplicate", async () => {
  const unavailable = {
    collection: () => ({
      doc: () => ({
        create: async () => {
          throw Object.assign(new Error("14 UNAVAILABLE: connection reset"), { code: 14 });
        },
      }),
    }),
  };
  await assert.rejects(claimWebhookEvent("evt_test_2", unavailable as never), /UNAVAILABLE/);
});
