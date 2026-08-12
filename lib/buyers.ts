import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { ConsentScope, ConsentChannel, ConsentAction, ConsentSource } from "./enums";

// Buyers are keyed on phone (E.164) — one person, one phone, tracked across every
// event and organizer. Never client-accessible; server/admin only. The buyer doc
// id IS the phone.

export async function findOrCreateBuyer(input: {
  phone: string; // E.164
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  postal_code: string;
  screening_interest?: boolean | null;
  sms_marketing_opt_in?: boolean;
  email_marketing_opt_in?: boolean;
  first_event_id?: string | null;
}): Promise<void> {
  const db = getDb();
  const ref = db.collection("buyers").doc(input.phone);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        phone: input.phone,
        email: input.email ?? null,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        postal_code: input.postal_code,
        screening_interest: input.screening_interest ?? null,
        sms_marketing_opt_in: !!input.sms_marketing_opt_in,
        email_marketing_opt_in: !!input.email_marketing_opt_in,
        first_event_id: input.first_event_id ?? null,
        created_at: FieldValue.serverTimestamp(),
      });
      return;
    }
    // Existing buyer: fill gaps, refresh contactable details, keep first_event_id.
    const d = snap.data()!;
    const update: Record<string, unknown> = {};
    if (input.email && !d.email) update.email = input.email;
    if (input.first_name && !d.first_name) update.first_name = input.first_name;
    if (input.last_name && !d.last_name) update.last_name = input.last_name;
    if (input.postal_code) update.postal_code = input.postal_code;
    if (input.screening_interest != null && d.screening_interest == null)
      update.screening_interest = input.screening_interest;
    if (input.sms_marketing_opt_in && !d.sms_marketing_opt_in) update.sms_marketing_opt_in = true;
    if (input.email_marketing_opt_in && !d.email_marketing_opt_in) update.email_marketing_opt_in = true;
    if (Object.keys(update).length) tx.update(ref, update);
  });
}

/** Append a consent record. Append-only — never updated or deleted (TCPA evidence). */
export async function recordConsent(input: {
  phone: string;
  scope: ConsentScope;
  channel: ConsentChannel;
  action: ConsentAction;
  source: ConsentSource;
  event_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  consent_text: string;
}): Promise<void> {
  await getDb()
    .collection("buyers")
    .doc(input.phone)
    .collection("consent")
    .add({
      scope: input.scope,
      channel: input.channel,
      action: input.action,
      source: input.source,
      event_id: input.event_id ?? null,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
      consent_text: input.consent_text,
      created_at: FieldValue.serverTimestamp(),
    });
}
