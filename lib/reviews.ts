import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { getEventById } from "./events";
import { getOrganizerById } from "./organizers";

// Earned social proof: one review per order, only after the night has
// happened, from someone who actually held a ticket. The order id is the
// bearer credential (same trust model as the ticket page). Organizers can
// hide a review but never edit it.

const COLL = "reviews";
const ENDED_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_TEXT = 500;

export type Review = {
  id: string;
  organizer_id: string;
  event_id: string;
  event_title: string;
  rating: number;
  text: string | null;
  first_name: string | null;
  created_at: number | null;
  hidden: boolean;
};

function toReview(id: string, d: FirebaseFirestore.DocumentData): Review {
  const ts = d.created_at as { toMillis?: () => number } | undefined;
  return {
    id,
    organizer_id: d.organizer_id,
    event_id: d.event_id,
    event_title: d.event_title ?? "",
    rating: d.rating ?? 0,
    text: d.text ?? null,
    first_name: d.first_name ?? null,
    created_at: ts?.toMillis ? ts.toMillis() : null,
    hidden: d.hidden === true,
  };
}

export type ReviewContext =
  | { ok: true; eventTitle: string; organizerName: string; organizerHandle: string; ended: boolean; existing: { rating: number; text: string | null } | null }
  | { ok: false };

/** What the rate page needs: is this a real ticket, has the night happened, did they already review? */
export async function reviewContext(orderId: string): Promise<ReviewContext> {
  const db = getDb();
  const order = await db.collection("orders").doc(orderId).get();
  if (!order.exists) return { ok: false };
  const o = order.data()!;
  if (o.status !== "paid" && o.status !== "transferred") return { ok: false };
  const [event, existing] = await Promise.all([getEventById(o.event_id), db.collection(COLL).doc(orderId).get()]);
  if (!event) return { ok: false };
  const organizer = await getOrganizerById(event.organizer_id);
  return {
    ok: true,
    eventTitle: event.title,
    organizerName: organizer?.name ?? "the organizer",
    organizerHandle: organizer?.handle ?? "",
    ended: event.starts_at + ENDED_AFTER_MS < Date.now(),
    existing: existing.exists ? { rating: existing.data()!.rating, text: existing.data()!.text ?? null } : null,
  };
}

export async function submitReview(input: { orderId: string; rating: number; text: string }): Promise<"ok" | "not_yet" | "invalid"> {
  const db = getDb();
  const order = await db.collection("orders").doc(input.orderId).get();
  if (!order.exists) return "invalid";
  const o = order.data()!;
  if (o.status !== "paid" && o.status !== "transferred") return "invalid";
  const event = await getEventById(o.event_id);
  if (!event) return "invalid";
  if (event.starts_at + ENDED_AFTER_MS >= Date.now()) return "not_yet";
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 5) return "invalid";
  const text = input.text.replace(/\r/g, "").trim().slice(0, MAX_TEXT) || null;

  const buyer = o.buyer_id ? await db.collection("buyers").doc(o.buyer_id).get() : null;
  const first_name = buyer?.exists ? ((buyer.data()!.first_name as string | null) ?? null) : null;

  const ref = db.collection(COLL).doc(input.orderId);
  const prior = await ref.get();
  await ref.set(
    {
      organizer_id: event.organizer_id,
      event_id: event.id,
      event_title: event.title,
      order_id: input.orderId,
      buyer_id: o.buyer_id ?? null,
      rating,
      text,
      first_name,
      hidden: prior.exists ? (prior.data()!.hidden === true) : false,
      ...(prior.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return "ok";
}

export async function getOrganizerRating(organizerId: string): Promise<{ avg: number; count: number }> {
  const snap = await getDb().collection(COLL).where("organizer_id", "==", organizerId).get();
  const visible = snap.docs.map((d) => d.data()).filter((d) => d.hidden !== true && d.rating >= 1);
  if (visible.length === 0) return { avg: 0, count: 0 };
  const avg = visible.reduce((s, d) => s + d.rating, 0) / visible.length;
  return { avg, count: visible.length };
}

/** Newest first. `includeHidden` is for the organizer's own list. */
export async function listOrganizerReviews(organizerId: string, max = 20, includeHidden = false): Promise<Review[]> {
  const snap = await getDb().collection(COLL).where("organizer_id", "==", organizerId).get();
  return snap.docs
    .map((d) => toReview(d.id, d.data()))
    .filter((r) => includeHidden || !r.hidden)
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, max);
}

export async function setReviewHidden(organizerId: string, reviewId: string, hidden: boolean): Promise<void> {
  const ref = getDb().collection(COLL).doc(reviewId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.organizer_id !== organizerId) return; // never across organizers
  await ref.update({ hidden, updated_at: FieldValue.serverTimestamp() });
}
