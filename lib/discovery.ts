import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { Attribution } from "./attribution";

// Discovery measurement for Experiment 001. Each tracked action is one small
// doc in `discovery_events`: what happened, to which place/story/event, and
// the VISIT context (visit id, first source, the story/place seen earlier in
// the visit, what they clicked from). No IP, no user agent, no personal data.
// The admin funnel below reads these plus orders' attribution to answer the
// pilot's questions per place and per story. Not a general analytics system.

export const DISCOVERY_EVENTS = [
  "place_viewed",
  "story_viewed",
  "story_video_played",
  "place_website_clicked",
  "place_instagram_clicked",
  "place_directions_clicked",
  "place_phone_clicked",
  "story_to_place_clicked",
  "place_to_event_clicked",
  "story_to_event_clicked",
  "event_viewed_from_place",
  "event_viewed_from_story",
  "checkout_viewed",
] as const;
export type DiscoveryEventName = (typeof DISCOVERY_EVENTS)[number];

export function isDiscoveryEvent(v: unknown): v is DiscoveryEventName {
  return typeof v === "string" && (DISCOVERY_EVENTS as readonly string[]).includes(v);
}

const COLL = "discovery_events";

export async function recordDiscoveryEvent(input: {
  name: DiscoveryEventName;
  attribution: Attribution;
  place_id: string | null;
  story_id: string | null;
  event_id: string | null;
  path: string | null;
}): Promise<void> {
  const a = input.attribution;
  await getDb().collection(COLL).add({
    name: input.name,
    visit_id: a.visit_id,
    place_id: input.place_id,
    story_id: input.story_id,
    event_id: input.event_id,
    // visit context: seen earlier in this visit / clicked from
    via_story_id: a.story_id,
    via_place_id: a.place_id,
    ref_type: a.ref_type,
    ref_id: a.ref_id,
    first_source: a.first_source,
    first_medium: a.first_medium,
    first_campaign: a.first_campaign,
    landing_path: a.landing_path,
    referrer_host: a.referrer_host,
    path: input.path,
    day: new Date().toISOString().slice(0, 10),
    at: FieldValue.serverTimestamp(),
  });
}

export type Funnel = {
  /** unique visits that viewed it (and total views) */
  views: { visits: number; total: number };
  /** where viewing visits came from (first source), most first */
  sources: { source: string; visits: number }[];
  campaigns: { campaign: string; visits: number }[];
  steps: { label: string; visits: number }[];
  purchases: { orders: number; tickets: number; gmv_cents: number; fee_cents: number; refunded_orders: number };
};

type Doc = FirebaseFirestore.DocumentData;
const uniq = (docs: Doc[]) => new Set(docs.map((d) => d.visit_id)).size;
const named = (docs: Doc[], ...names: DiscoveryEventName[]) => docs.filter((d) => names.includes(d.name));

function rank(docs: Doc[], key: "first_source" | "first_campaign"): { k: string; visits: number }[] {
  const byVisit = new Map<string, string>();
  for (const d of docs) if (d[key] && !byVisit.has(d.visit_id)) byVisit.set(d.visit_id, d[key]);
  const counts = new Map<string, number>();
  for (const v of byVisit.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([k, visits]) => ({ k, visits })).sort((a, b) => b.visits - a.visits);
}

async function purchasesAttributedTo(field: "attribution.place_id" | "attribution.story_id", id: string) {
  const snap = await getDb().collection("orders").where(field, "==", id).get();
  const out = { orders: 0, tickets: 0, gmv_cents: 0, fee_cents: 0, refunded_orders: 0 };
  for (const doc of snap.docs) {
    const o = doc.data();
    if (o.is_sample) continue; // demo checkouts never count as results
    if (o.status === "refunded") {
      out.refunded_orders++;
      continue;
    }
    if (o.status !== "paid" && o.status !== "transferred") continue;
    out.orders++;
    out.tickets += o.purchased_quantity ?? o.quantity ?? 0;
    out.gmv_cents += o.subtotal_cents ?? 0;
    out.fee_cents += o.fee_cents ?? 0;
  }
  return out;
}

async function eventsWhere(field: string, id: string): Promise<Doc[]> {
  const snap = await getDb().collection(COLL).where(field, "==", id).limit(20000).get();
  return snap.docs.map((d) => d.data());
}

/** The pilot questions for one Story. */
export async function getStoryFunnel(storyId: string): Promise<Funnel> {
  const [own, downstream, purchases] = await Promise.all([
    eventsWhere("story_id", storyId), // things done ON the story page
    eventsWhere("via_story_id", storyId), // later in a visit that saw the story
    purchasesAttributedTo("attribution.story_id", storyId),
  ]);
  const views = named(own, "story_viewed");
  return {
    views: { visits: uniq(views), total: views.length },
    sources: rank(views, "first_source").map(({ k, visits }) => ({ source: k, visits })),
    campaigns: rank(views, "first_campaign").map(({ k, visits }) => ({ campaign: k, visits })),
    steps: [
      { label: "Played the video", visits: uniq(named(own, "story_video_played")) },
      { label: "Story → Place", visits: uniq(named(own, "story_to_place_clicked")) },
      { label: "Story → Event (directly)", visits: uniq(named(own, "story_to_event_clicked")) },
      { label: "Reached an event page (any path)", visits: uniq([...named(own, "event_viewed_from_story"), ...named(downstream, "event_viewed_from_place", "event_viewed_from_story")]) },
      { label: "Reached checkout", visits: uniq(named(downstream, "checkout_viewed")) },
    ],
    purchases,
  };
}

/** The pilot questions for one Place. */
export async function getPlaceFunnel(placeId: string): Promise<Funnel> {
  const [own, downstream, purchases] = await Promise.all([
    eventsWhere("place_id", placeId),
    eventsWhere("via_place_id", placeId),
    purchasesAttributedTo("attribution.place_id", placeId),
  ]);
  const views = named(own, "place_viewed");
  return {
    views: { visits: uniq(views), total: views.length },
    sources: rank(views, "first_source").map(({ k, visits }) => ({ source: k, visits })),
    campaigns: rank(views, "first_campaign").map(({ k, visits }) => ({ campaign: k, visits })),
    steps: [
      { label: "Arrived from a Hapnin story", visits: uniq(views.filter((d) => d.ref_type === "story" || d.via_story_id)) },
      { label: "Website", visits: uniq(named(own, "place_website_clicked")) },
      { label: "Instagram", visits: uniq(named(own, "place_instagram_clicked")) },
      { label: "Directions", visits: uniq(named(own, "place_directions_clicked")) },
      { label: "Call", visits: uniq(named(own, "place_phone_clicked")) },
      { label: "Place → Event", visits: uniq(named(own, "place_to_event_clicked")) },
      { label: "Reached checkout", visits: uniq(named(downstream, "checkout_viewed")) },
    ],
    purchases,
  };
}
