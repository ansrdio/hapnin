// Nothing personal may leave for Sentry: emails and phone numbers are redacted
// from every string in an outgoing event, ids are kept.

import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, scrubEvent } from "../lib/monitoring.ts";

test("emails and phone numbers are redacted, ids survive", () => {
  const s = redact("refund emailed to ada.o@example.com and texted +14805551234 for order x4HOSnyGVvYPa2gUf9A8 pi_3Abc");
  assert.equal(s.includes("example.com"), false);
  assert.equal(s.includes("5551234"), false);
  assert.ok(s.includes("x4HOSnyGVvYPa2gUf9A8"));
  assert.ok(s.includes("pi_3Abc"));
});

test("US phone spellings are all caught", () => {
  for (const p of ["(480) 555-1234", "480-555-1234", "480.555.1234", "4805551234", "+1 480 555 1234"]) {
    assert.equal(redact(`call ${p} now`), "call [phone] now", p);
  }
});

test("scrubEvent walks nested structures and drops the user object", () => {
  const ev = {
    message: "sendLoginLink error for jo@example.com",
    exception: { values: [{ value: "Brevo rejected jo@example.com", stacktrace: { frames: [{ vars: { to: "jo@example.com" } }] } }] },
    extra: { buyer: { phone: "+14805551234", tags: ["vip", "ada@example.com"] } },
    user: { email: "jo@example.com" },
    event_id: "abc",
  };
  const out = scrubEvent(ev) as Record<string, unknown>;
  assert.equal(JSON.stringify(out).includes("example.com"), false);
  assert.equal(JSON.stringify(out).includes("5551234"), false);
  assert.equal("user" in out, false);
  assert.equal(out.event_id, "abc");
});
