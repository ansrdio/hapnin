import "server-only";
import { createEvent, createTable, getTiers, type EventRecord } from "./events";
import type { EventStatus } from "./enums";
import { slugify } from "./event-input";

// Recurring series: the weekly night, created N times from one template —
// details, flyer, refund policy, bring-a-friend, GA tiers (sale windows
// shifted with the date) and tables. Each instance is its own event so it can
// be edited, published, or cancelled on its own.

export type Cadence = "weekly" | "biweekly" | "monthly";
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** The next occurrence after `from` for a cadence (monthly keeps the same day-of-month, Phoenix wall time). */
export function nextOccurrence(from: number, cadence: Cadence): number {
  if (cadence === "weekly") return from + WEEK;
  if (cadence === "biweekly") return from + 2 * WEEK;
  const d = new Date(from);
  const month = new Date(d);
  month.setUTCMonth(month.getUTCMonth() + 1);
  return month.getTime();
}

export async function cloneEvent(input: {
  source: EventRecord;
  organizerId: string;
  startsAt: number;
  status: EventStatus;
}): Promise<{ id: string }> {
  const { source } = input;
  const tiers = await getTiers(source.id);
  const delta = input.startsAt - source.starts_at;
  const shift = (ms: number | null) => (ms == null ? null : ms + delta);
  const stem = slugify(source.title) ?? "event";

  let created: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const slug = `${stem}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      created = await createEvent({
        organizer_id: input.organizerId,
        title: source.title,
        slug,
        description: source.description,
        flyer_url: source.flyer_url,
        venue_name: source.venue_name,
        venue_address: source.venue_address,
        venue_zip: source.venue_zip,
        city: source.city,
        state: source.state,
        starts_at: input.startsAt,
        doors_at: shift(source.doors_at),
        timezone: source.timezone,
        status: input.status,
        capacity: source.capacity,
        refund_policy: source.refund_policy,
        referral_off_cents: source.referral_off_cents,
        event_type: source.event_type,
        community: source.community,
        primary_language: source.primary_language,
        genre: source.genre,
        talent: source.talent,
        is_first_event: false,
        tiers: tiers
          .filter((t) => t.kind !== "table")
          .map((t) => ({
            name: t.name,
            price_cents: t.price_cents,
            quantity_total: t.quantity_total,
            sales_start_at: shift(t.sales_start_at),
            sales_end_at: shift(t.sales_end_at),
          })),
      });
    } catch (err) {
      if ((err as Error).message !== "SLUG_TAKEN") throw err;
    }
  }
  if (!created) throw new Error("SLUG_TAKEN");
  for (const t of tiers.filter((t) => t.kind === "table")) {
    await createTable(created.id, { name: t.name, seats: t.seats ?? 1, price_cents: t.price_cents });
  }
  return created;
}

/** Create `count` future instances after the source date. Returns the new ids in date order. */
export async function createSeries(input: {
  source: EventRecord;
  organizerId: string;
  cadence: Cadence;
  count: number;
  publish: boolean;
}): Promise<string[]> {
  const count = Math.max(1, Math.min(12, Math.floor(input.count)));
  const ids: string[] = [];
  let at = input.source.starts_at;
  for (let i = 0; i < count; i++) {
    at = nextOccurrence(at, input.cadence);
    const { id } = await cloneEvent({ source: input.source, organizerId: input.organizerId, startsAt: at, status: input.publish ? "on_sale" : "draft" });
    ids.push(id);
  }
  return ids;
}
