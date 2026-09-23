// Scrubbing for anything sent to Sentry. Client-safe (no server-only import):
// the same function runs in the browser, on Node and on the Edge runtime.
//
// Buyers are keyed by phone and reached by email, and both show up in log
// lines ("refund emailed to …"). Sentry must never hold either, so every
// string in an outgoing event is redacted before it leaves. Ticket, order and
// PaymentIntent ids are fine — they are how an incident gets traced.

type AnyRecord = Record<string, unknown>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// E.164 and common US spellings: +14805551234, (480) 555-1234, 480-555-1234, 480.555.1234
const PHONE = /(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

export function redact(s: string): string {
  return s.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

function walk(v: unknown, depth = 0): unknown {
  if (depth > 8) return v;
  if (typeof v === "string") return redact(v);
  if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
  if (v && typeof v === "object") {
    const out: AnyRecord = {};
    for (const [k, x] of Object.entries(v as AnyRecord)) out[k] = walk(x, depth + 1);
    return out;
  }
  return v;
}

/** Sentry `beforeSend`: redact emails and phone numbers everywhere in the event. */
export function scrubEvent<E extends object>(event: E): E {
  const e = event as AnyRecord;
  for (const key of ["message", "logentry", "exception", "extra", "contexts", "breadcrumbs", "request"]) {
    if (key in e) e[key] = walk(e[key]);
  }
  // Never send the user object even if something set it.
  delete e.user;
  return e as E;
}
