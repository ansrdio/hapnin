import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";

// Per-event discount codes. `kind` is "percent" (value = 1..100) or "amount"
// (value = cents off). Optional max_redemptions caps total uses. doc id =
// `${eventId}:${code}` (code uppercased). Discount is always computed here,
// server-side, from the stored code — never trusted from the client.

const COLL = "promo_codes";

export type PromoKind = "percent" | "amount";

export type PromoCode = {
  id: string;
  event_id: string;
  organizer_id: string;
  code: string;
  kind: PromoKind;
  value: number;
  max_redemptions: number | null;
  times_redeemed: number;
  active: boolean;
};

export function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

function toPromo(id: string, d: FirebaseFirestore.DocumentData): PromoCode {
  return {
    id,
    event_id: d.event_id,
    organizer_id: d.organizer_id,
    code: d.code,
    kind: d.kind,
    value: d.value,
    max_redemptions: d.max_redemptions ?? null,
    times_redeemed: d.times_redeemed ?? 0,
    active: d.active !== false,
  };
}

export async function createPromoCode(input: {
  eventId: string;
  organizerId: string;
  code: string;
  kind: PromoKind;
  value: number;
  maxRedemptions: number | null;
}): Promise<PromoCode> {
  const db = getDb();
  const code = normalizeCode(input.code);
  const data = {
    event_id: input.eventId,
    organizer_id: input.organizerId,
    code,
    kind: input.kind,
    value: input.value,
    max_redemptions: input.maxRedemptions,
    times_redeemed: 0,
    active: true,
    created_at: FieldValue.serverTimestamp(),
  };
  try {
    const ref = db.collection(COLL).doc(`${input.eventId}:${code}`);
    await ref.create(data);
    return toPromo(ref.id, data);
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) throw new Error("CODE_TAKEN");
    throw err;
  }
}

export async function listPromoCodes(eventId: string): Promise<PromoCode[]> {
  const snap = await getDb().collection(COLL).where("event_id", "==", eventId).get();
  return snap.docs.map((d) => toPromo(d.id, d.data())).sort((a, b) => a.code.localeCompare(b.code));
}

/** Resolve a code for an event; returns null if unknown, inactive, or used up. */
export async function resolvePromo(eventId: string, rawCode: string): Promise<PromoCode | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const snap = await getDb().collection(COLL).doc(`${eventId}:${code}`).get();
  if (!snap.exists) return null;
  const p = toPromo(snap.id, snap.data()!);
  if (!p.active) return null;
  if (p.max_redemptions != null && p.times_redeemed >= p.max_redemptions) return null;
  return p;
}

/** Discount in cents this promo applies to a subtotal (never exceeds it). */
export function promoDiscountCents(promo: PromoCode, subtotalCents: number): number {
  const raw = promo.kind === "percent" ? Math.round((subtotalCents * promo.value) / 100) : promo.value;
  return Math.max(0, Math.min(raw, subtotalCents));
}

export async function adjustPromoRedemption(id: string, delta: number): Promise<void> {
  await getDb().collection(COLL).doc(id).update({ times_redeemed: FieldValue.increment(delta) });
}
