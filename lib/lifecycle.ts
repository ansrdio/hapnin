import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import { listEventsByOrganizer, type EventRecord } from "./events";
import { getOrganizerById } from "./organizers";
import { getOrCreateUnsubToken } from "./buyers";
import { listBroadcasts } from "./broadcasts";
import { sendReminderEmail, sendBroadcastEmail } from "./email";

// Lifecycle emails, run once a day by cron (9am Phoenix). Three stages per
// event, each sent at most once — a `lifecycle_sends/{eventId}:{stage}` doc is
// claimed with create() BEFORE sending, so a retried or overlapping run can't
// double-send.
//
//   reminder — event starts in 16h–40h  → "Tomorrow: …"   (all ticket holders)
//   dayof    — event starts in 0h–16h   → "Tonight: …"    (all ticket holders)
//   thanks   — event ended 0h–30h ago    → thank-you        (opted-in buyers),
//              skipped if the organizer already sent a broadcast after the end
//
// Reminders are transactional (you hold a ticket); the thank-you is marketing
// (it may link the next event) so it goes only to opted-in buyers with the
// usual unsubscribe link.

const H = 60 * 60 * 1000;
const ENDED_AFTER_MS = 6 * H;

export type LifecycleStage = "reminder" | "dayof" | "thanks";
export type LifecycleSend = { stage: LifecycleStage; eventId: string; title: string; recipients: number; sent: number; failed: number; note?: string };
export type LifecycleResult = { checked: number; sends: LifecycleSend[]; dryRun: boolean };

function stageFor(e: EventRecord, now: number): LifecycleStage | null {
  const until = e.starts_at - now;
  if (until > 16 * H && until <= 40 * H) return "reminder";
  if (until > 0 && until <= 16 * H) return "dayof";
  const ended = e.starts_at + ENDED_AFTER_MS;
  if (now >= ended && now - ended <= 30 * H) return "thanks";
  return null;
}

function fmtWhen(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz,
  }).format(new Date(ms));
}

/** Claim a stage for an event. False = already sent (or claimed) before. */
async function claim(eventId: string, stage: LifecycleStage, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    const snap = await getDb().collection("lifecycle_sends").doc(`${eventId}:${stage}`).get();
    return !snap.exists;
  }
  try {
    await getDb().collection("lifecycle_sends").doc(`${eventId}:${stage}`).create({
      event_id: eventId,
      stage,
      claimed_at: FieldValue.serverTimestamp(),
    });
    return true;
  } catch {
    return false; // ALREADY_EXISTS
  }
}

type Holder = { orderId: string; phone: string; email: string; first_name: string | null; opted_in: boolean };

/** Paid orders → buyers with an email. One entry per order (each order has its own ticket page). */
async function ticketHolders(eventId: string): Promise<Holder[]> {
  const db = getDb();
  const orders = await db.collection("orders").where("event_id", "==", eventId).get();
  const paid = orders.docs.filter((d) => d.data().status === "paid");
  const phones = [...new Set(paid.map((d) => d.data().buyer_id as string).filter(Boolean))];
  if (phones.length === 0) return [];
  const snaps = await db.getAll(...phones.map((p) => db.collection("buyers").doc(p)));
  const buyers = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));
  const out: Holder[] = [];
  for (const d of paid) {
    const b = buyers.get(d.data().buyer_id);
    if (!b?.email) continue;
    out.push({ orderId: d.id, phone: d.data().buyer_id, email: b.email, first_name: b.first_name ?? null, opted_in: b.email_marketing_opt_in === true });
  }
  return out;
}

export async function runLifecycle(opts: { dryRun?: boolean; now?: number } = {}): Promise<LifecycleResult> {
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? Date.now();
  const db = getDb();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

  // On-sale events only; time windows filtered in code (single-field query).
  const snap = await db.collection("events").where("status", "==", "on_sale").limit(200).get();
  const result: LifecycleResult = { checked: snap.size, sends: [], dryRun };

  for (const doc of snap.docs) {
    const d = doc.data();
    const e = { id: doc.id, ...d, starts_at: (d.starts_at as { toMillis?: () => number })?.toMillis?.() ?? d.starts_at } as EventRecord;
    if (typeof e.starts_at !== "number") continue;
    const stage = stageFor(e, now);
    if (!stage) continue;

    // Organizer already thanked their guests by hand → don't double up.
    if (stage === "thanks") {
      const recent = await listBroadcasts(e.id, 5);
      if (recent.some((b) => b.created_at >= e.starts_at + ENDED_AFTER_MS)) {
        result.sends.push({ stage, eventId: e.id, title: e.title, recipients: 0, sent: 0, failed: 0, note: "organizer already sent a post-event message" });
        continue;
      }
    }

    if (!(await claim(e.id, stage, dryRun))) continue; // done before

    const holders = await ticketHolders(e.id);
    const targets = stage === "thanks" ? holders.filter((h) => h.opted_in) : holders;
    const send: LifecycleSend = { stage, eventId: e.id, title: e.title, recipients: targets.length, sent: 0, failed: 0 };
    result.sends.push(send);
    if (dryRun || targets.length === 0) continue;

    const whenText = fmtWhen(e.starts_at, e.timezone ?? "America/Phoenix");
    if (stage === "thanks") {
      const organizer = await getOrganizerById(e.organizer_id);
      const organizerName = organizer?.name ?? "Your organizer";
      const nextUp = (await listEventsByOrganizer(e.organizer_id))
        .filter((x) => x.id !== e.id && x.status === "on_sale" && x.starts_at > now)
        .sort((a, b) => a.starts_at - b.starts_at)[0];
      const subject = `Thank you for coming to ${e.title}`;
      const body =
        `Thank you for coming out to ${e.title} — you made the night.\n\n` +
        (nextUp
          ? `Next up: ${nextUp.title}, ${fmtWhen(nextUp.starts_at, nextUp.timezone)}. Tickets: ${site}/e/${nextUp.slug}`
          : "We’ll let you know the moment the next one drops.") +
        `\n\n— ${organizerName}`;
      // De-dupe by email for the thank-you (one per person, not per order).
      const seen = new Set<string>();
      for (const h of targets) {
        if (seen.has(h.email)) continue;
        seen.add(h.email);
        const token = await getOrCreateUnsubToken(h.phone);
        const r = await sendBroadcastEmail({
          to: h.email, firstName: h.first_name, organizerName, eventTitle: e.title, subject, body,
          eventUrl: `${site}/e/${e.slug}`, unsubscribeUrl: `${site}/unsubscribe/${token ?? "unknown"}`,
        }).catch(() => ({ ok: false }));
        r.ok ? send.sent++ : send.failed++;
      }
    } else {
      for (const h of targets) {
        const r = await sendReminderEmail({
          to: h.email, firstName: h.first_name, kind: stage === "dayof" ? "today" : "tomorrow",
          eventTitle: e.title, whenText, venue: e.venue_name, address: [e.venue_address, e.city].filter(Boolean).join(", "),
          ticketUrl: `${site}/t/${h.orderId}`, flyerUrl: e.flyer_url ?? null,
        }).catch(() => ({ ok: false }));
        r.ok ? send.sent++ : send.failed++;
      }
    }
    await db.collection("lifecycle_sends").doc(`${e.id}:${stage}`).update({ sent: send.sent, failed: send.failed, sent_at: FieldValue.serverTimestamp() });
  }
  return result;
}
