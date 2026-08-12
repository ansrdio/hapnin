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
};

export type EventRecord = {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  description: string | null;
  flyer_url: string | null;
  venue_name: string;
  venue_address: string;
  city: string;
  state: string;
  starts_at: number; // epoch ms
  doors_at: number | null;
  timezone: string;
  status: EventStatus;
  capacity: number | null;
  event_type: EventType;
  community: Community;
  primary_language: LanguageCode;
  genre: Genre;
  talent: string[];
  is_first_event: boolean; // free launch event → application_fee 0
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
    city: d.city,
    state: d.state,
    starts_at: tsToMs(d.starts_at) ?? 0,
    doors_at: tsToMs(d.doors_at),
    timezone: d.timezone ?? "America/Phoenix",
    status: d.status,
    capacity: d.capacity ?? null,
    event_type: d.event_type,
    community: d.community,
    primary_language: d.primary_language,
    genre: d.genre,
    talent: d.talent ?? [],
    is_first_event: !!d.is_first_event,
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

export async function listEventsByOrganizer(organizerId: string): Promise<EventRecord[]> {
  const snap = await getDb()
    .collection(EVENTS)
    .where("organizer_id", "==", organizerId)
    .orderBy("starts_at", "desc")
    .get();
  return snap.docs.map((d) => toEvent(d.id, d.data()));
}

export type NewTier = {
  name: string;
  price_cents: number;
  quantity_total: number;
};

export async function createEvent(input: {
  organizer_id: string;
  title: string;
  slug: string;
  description?: string | null;
  venue_name: string;
  venue_address: string;
  city: string;
  state: string;
  starts_at: number;
  doors_at?: number | null;
  timezone?: string;
  status?: EventStatus;
  capacity?: number | null;
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
    flyer_url: null,
    venue_name: input.venue_name,
    venue_address: input.venue_address,
    city: input.city,
    state: input.state,
    starts_at: input.starts_at,
    doors_at: input.doors_at ?? null,
    timezone: input.timezone ?? "America/Phoenix",
    status: input.status ?? "draft",
    capacity: input.capacity ?? null,
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
      sales_start_at: null,
      sales_end_at: null,
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
