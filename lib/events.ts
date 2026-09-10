import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";
import type { EventStatus, EventType, Community, LanguageCode, Genre } from "./enums";

export type Tier = {
  id: string;
  name: string;
  price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  sales_start_at: number | null; // epoch ms
  sales_end_at: number | null;
  is_active: boolean;
  sort_order: number;
  kind: "ga" | "table"; // "table" = a reserved table / bottle-service booth
  seats: number | null; // guests a table admits
};

// Refund policy the organizer sets per event; shown to buyers before they pay.
// Values + labels live in the client-safe module so forms can share them.
export { REFUND_POLICIES, REFUND_POLICY_LABELS, REFUND_POLICY_SHORT, isRefundPolicy } from "./refund-policy";
export type { RefundPolicy } from "./refund-policy";
import type { RefundPolicy } from "./refund-policy";

export type EventRecord = {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  description: string | null;
  flyer_url: string | null;
  venue_name: string;
  venue_address: string;
  venue_zip: string | null;
  city: string;
  state: string;
  starts_at: number; // epoch ms
  doors_at: number | null;
  timezone: string;
  status: EventStatus;
  capacity: number | null;
  refund_policy: RefundPolicy;
  referral_off_cents: number; // bring-a-friend: flat discount for a referred friend; 0 = off
  event_type: EventType;
  community: Community;
  primary_language: LanguageCode;
  genre: Genre;
  talent: string[];
  is_first_event: boolean; // free launch event → application_fee 0
  // Live counters, bumped by fulfillment (tickets_sold/gross_cents) and the door
  // scanner (checked_in). Default 0 until the first sale/scan.
  tickets_sold: number;
  gross_cents: number;
  checked_in: number;
};

const EVENTS = "events";

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number };
  return t.toMillis ? t.toMillis() : null;
}

function toEvent(id: string, d: FirebaseFirestore.DocumentData): EventRecord {
  return {
    id,
    organizer_id: d.organizer_id,
    title: d.title,
    slug: d.slug,
    description: d.description ?? null,
    flyer_url: d.flyer_url ?? null,
    venue_name: d.venue_name,
    venue_address: d.venue_address,
    venue_zip: d.venue_zip ?? null,
    city: d.city,
    state: d.state,
    starts_at: tsToMs(d.starts_at) ?? 0,
    doors_at: tsToMs(d.doors_at),
    timezone: d.timezone ?? "America/Phoenix",
    status: d.status,
    capacity: d.capacity ?? null,
    refund_policy: (d.refund_policy ?? "none") as RefundPolicy,
    referral_off_cents: d.referral_off_cents ?? 0,
    event_type: d.event_type,
    community: d.community,
    primary_language: d.primary_language,
    genre: d.genre,
    talent: d.talent ?? [],
    is_first_event: !!d.is_first_event,
    tickets_sold: d.tickets_sold ?? 0,
    gross_cents: d.gross_cents ?? 0,
    checked_in: d.checked_in ?? 0,
  };
}

function toTier(id: string, d: FirebaseFirestore.DocumentData): Tier {
  return {
    id,
    name: d.name,
    price_cents: d.price_cents,
    quantity_total: d.quantity_total,
    quantity_sold: d.quantity_sold ?? 0,
    sales_start_at: tsToMs(d.sales_start_at),
    sales_end_at: tsToMs(d.sales_end_at),
    is_active: d.is_active !== false,
    sort_order: d.sort_order ?? 0,
    kind: d.kind === "table" ? "table" : "ga",
    seats: d.seats ?? null,
  };
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  const snap = await getDb().collection(EVENTS).doc(id).get();
  return snap.exists ? toEvent(snap.id, snap.data()!) : null;
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const lookup = await getDb().collection("event_slugs").doc(slug.toLowerCase()).get();
  if (!lookup.exists) return null;
  return getEventById(lookup.data()!.event_id);
}

export async function getTiers(eventId: string): Promise<Tier[]> {
  const snap = await getDb().collection(EVENTS).doc(eventId).collection("tiers").orderBy("sort_order").get();
  return snap.docs.map((d) => toTier(d.id, d.data()));
}

export async function getTier(eventId: string, tierId: string): Promise<Tier | null> {
  const snap = await getDb().collection(EVENTS).doc(eventId).collection("tiers").doc(tierId).get();
  return snap.exists ? toTier(snap.id, snap.data()!) : null;
}

/** All on-sale events across organizers, upcoming first — the public finder feed. */
export async function listOnSaleEvents(max = 60): Promise<EventRecord[]> {
  const snap = await getDb().collection(EVENTS).where("status", "==", "on_sale").get();
  const cutoff = Date.now() - 12 * 60 * 60 * 1000; // keep events until ~12h after start
  return snap.docs
    .map((d) => toEvent(d.id, d.data()))
    .filter((e) => e.starts_at >= cutoff)
    .sort((a, b) => a.starts_at - b.starts_at)
    .slice(0, max);
}

export async function listEventsByOrganizer(organizerId: string): Promise<EventRecord[]> {
  // Equality-only query so Firestore auto-indexes it (a `where` + `orderBy` on a
  // different field would need a composite index). An organizer has few events,
  // so sort newest-first in memory.
  const snap = await getDb().collection(EVENTS).where("organizer_id", "==", organizerId).get();
  return snap.docs.map((d) => toEvent(d.id, d.data())).sort((a, b) => b.starts_at - a.starts_at);
}

/** Flip an event's status (publish → on_sale, unpublish → draft, etc.). */
export async function setEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await getDb().collection(EVENTS).doc(eventId).update({ status });
}

/** Set (or clear) an event's flyer image URL. */
export async function setEventFlyer(eventId: string, flyerUrl: string | null): Promise<void> {
  await getDb().collection(EVENTS).doc(eventId).update({ flyer_url: flyerUrl });
}

/** Delete an event, its tiers, and its slug reservation. Caller guards no-sales. */
export async function deleteEvent(eventId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(EVENTS).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const slug = snap.data()!.slug as string | undefined;
  const tiers = await ref.collection("tiers").get();
  const batch = db.batch();
  tiers.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  if (slug) batch.delete(db.collection("event_slugs").doc(slug));
  await batch.commit();
}

export type EventDetailsUpdate = {
  title: string;
  description: string | null;
  venue_name: string;
  venue_address: string;
  venue_zip: string | null;
  city: string;
  state: string;
  starts_at: number;
  capacity: number | null;
  refund_policy: RefundPolicy;
  referral_off_cents: number; // bring-a-friend: flat discount for a referred friend; 0 = off
  event_type: EventType;
  community: Community;
  primary_language: LanguageCode;
  genre: Genre;
  talent: string[];
};

/** Update an event's editable details (slug + status + counters are untouched). */
export async function updateEventDetails(eventId: string, d: EventDetailsUpdate): Promise<void> {
  await getDb().collection(EVENTS).doc(eventId).update({ ...d });
}

/** Update an existing GA tier. quantity_total can't drop below what's sold. */
export async function updateTier(
  eventId: string,
  tierId: string,
  d: { name: string; price_cents: number; quantity_total: number; is_active: boolean }
): Promise<void> {
  const ref = getDb().collection(EVENTS).doc(eventId).collection("tiers").doc(tierId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const sold = snap.data()!.quantity_sold ?? 0;
  await ref.update({
    name: d.name,
    price_cents: d.price_cents,
    quantity_total: Math.max(d.quantity_total, sold),
    is_active: d.is_active,
  });
}

/** Append a new GA tier to an existing event. */
export async function addTierToEvent(
  eventId: string,
  d: { name: string; price_cents: number; quantity_total: number }
): Promise<void> {
  await getDb().collection(EVENTS).doc(eventId).collection("tiers").doc().set({
    name: d.name,
    price_cents: d.price_cents,
    quantity_total: d.quantity_total,
    quantity_sold: 0,
    sales_start_at: null,
    sales_end_at: null,
    is_active: true,
    sort_order: 999,
    kind: "ga",
    seats: null,
  });
}

/** Add a reserved table / bottle-service booth (a tier with kind="table"). */
export async function createTable(
  eventId: string,
  input: { name: string; seats: number; price_cents: number }
): Promise<void> {
  const ref = getDb().collection(EVENTS).doc(eventId).collection("tiers").doc();
  await ref.set({
    name: input.name,
    price_cents: input.price_cents,
    quantity_total: 1,
    quantity_sold: 0,
    sales_start_at: null,
    sales_end_at: null,
    is_active: true,
    sort_order: 100,
    kind: "table",
    seats: input.seats,
  });
}

export type NewTier = {
  name: string;
  price_cents: number;
  quantity_total: number;
  sales_start_at?: number | null; // epoch ms
  sales_end_at?: number | null;
};

export async function createEvent(input: {
  organizer_id: string;
  title: string;
  slug: string;
  description?: string | null;
  flyer_url?: string | null;
  venue_name: string;
  venue_address: string;
  venue_zip?: string | null;
  city: string;
  state: string;
  starts_at: number;
  doors_at?: number | null;
  timezone?: string;
  status?: EventStatus;
  capacity?: number | null;
  refund_policy?: RefundPolicy;
  referral_off_cents?: number;
  event_type: EventType;
  community: Community;
  primary_language: LanguageCode;
  genre: Genre;
  talent?: string[];
  is_first_event?: boolean;
  tiers: NewTier[];
}): Promise<EventRecord> {
  const db = getDb();
  const slug = input.slug.toLowerCase();
  const ref = db.collection(EVENTS).doc();

  try {
    await db.collection("event_slugs").doc(slug).create({ event_id: ref.id });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) throw new Error("SLUG_TAKEN");
    throw err;
  }

  const data = {
    organizer_id: input.organizer_id,
    title: input.title,
    slug,
    description: input.description ?? null,
    flyer_url: input.flyer_url ?? null,
    venue_name: input.venue_name,
    venue_address: input.venue_address,
    venue_zip: input.venue_zip ?? null,
    city: input.city,
    state: input.state,
    starts_at: input.starts_at,
    doors_at: input.doors_at ?? null,
    timezone: input.timezone ?? "America/Phoenix",
    status: input.status ?? "draft",
    capacity: input.capacity ?? null,
    refund_policy: input.refund_policy ?? "none",
    referral_off_cents: input.referral_off_cents ?? 0,
    event_type: input.event_type,
    community: input.community,
    primary_language: input.primary_language,
    genre: input.genre,
    talent: input.talent ?? [],
    is_first_event: input.is_first_event ?? false,
    tickets_sold: 0,
    gross_cents: 0,
    created_at: FieldValue.serverTimestamp(),
  };
  await ref.set(data);

  const batch = db.batch();
  input.tiers.forEach((t, i) => {
    const tref = ref.collection("tiers").doc();
    batch.set(tref, {
      name: t.name,
      price_cents: t.price_cents,
      quantity_total: t.quantity_total,
      quantity_sold: 0,
      sales_start_at: t.sales_start_at ?? null,
      sales_end_at: t.sales_end_at ?? null,
      is_active: true,
      sort_order: i,
    });
  });
  await batch.commit();

  return toEvent(ref.id, data);
}

/**
 * Atomically reserve inventory on a tier. Runs in a Firestore transaction so
 * concurrent checkouts can't oversell (the "never read-then-write" rule from the
 * SQL `reserve_tier_inventory`). Throws "SOLD_OUT" if it can't fit.
 */
export async function reserveInventory(eventId: string, tierId: string, qty: number): Promise<void> {
  const db = getDb();
  const ref = db.collection(EVENTS).doc(eventId).collection("tiers").doc(tierId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("TIER_NOT_FOUND");
    const d = snap.data()!;
    const sold = d.quantity_sold ?? 0;
    if (d.is_active === false || sold + qty > d.quantity_total) throw new Error("SOLD_OUT");
    tx.update(ref, { quantity_sold: sold + qty });
  });
}

export async function releaseInventory(eventId: string, tierId: string, qty: number): Promise<void> {
  const db = getDb();
  const ref = db.collection(EVENTS).doc(eventId).collection("tiers").doc(tierId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const sold = snap.data()!.quantity_sold ?? 0;
    tx.update(ref, { quantity_sold: Math.max(0, sold - qty) });
  });
}
