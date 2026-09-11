import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { getDb } from "./firebase-admin";
import { listEventsByOrganizer, getEventById } from "./events";
import { getOrganizerById } from "./organizers";
import { getOrCreateUnsubToken } from "./buyers";
import { sendAnnouncementEmail } from "./email";
import { normalizeEmail, normalizeUsPhone } from "./validation";

// An organizer's imported audience — the list they already have (Eventbrite
// exports, a spreadsheet, followers who gave an email). Rules:
//   • EMAIL is the channel. Every announcement carries a one-click unsubscribe
//     and says why the reader is getting it.
//   • PHONES ARE NEVER TEXTED. US law needs the person's own prior written
//     consent for marketing texts; an organizer's attestation isn't that.
//     Phones are kept only to recognise the person at checkout / the door.
//   • The organizer attests they have permission to contact these people;
//     we record who attested and when.

const COLL = "contacts";
export const IMPORT_MAX_ROWS = 5000;
export const ANNOUNCE_MAX_RECIPIENTS = 2000;
const SEND_CONCURRENCY = 20;

export type ContactRow = { email: string; phone: string | null; first_name: string | null; last_name: string | null };

// ── Parsing ──────────────────────────────────────────────────────────────────

/** Split one CSV line respecting double quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const H = {
  email: /^(e-?mail|email address|attendee email|buyer email)$/i,
  phone: /^(phone|mobile|cell|cell phone|mobile phone|phone number|telephone)$/i,
  first: /^(first name|first|given name|firstname)$/i,
  last: /^(last name|last|surname|family name|lastname)$/i,
  name: /^(name|full name|attendee name|buyer name)$/i,
};

/**
 * Parse pasted text or a CSV into contact rows. Handles: a header row with
 * recognisable columns (Eventbrite exports included); header-less lines that
 * are "email", "email, name", or "name <email>"; blank lines and junk skipped.
 * De-duplicated by email. Caps at IMPORT_MAX_ROWS.
 */
export function parseContacts(text: string): { rows: ContactRow[]; skipped: number; truncated: boolean } {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const byEmail = new Map<string, ContactRow>();
  let skipped = 0;
  if (lines.length === 0) return { rows: [], skipped, truncated: false };

  const header = splitCsvLine(lines[0]);
  const idx = {
    email: header.findIndex((h) => H.email.test(h)),
    phone: header.findIndex((h) => H.phone.test(h)),
    first: header.findIndex((h) => H.first.test(h)),
    last: header.findIndex((h) => H.last.test(h)),
    name: header.findIndex((h) => H.name.test(h)),
  };
  const hasHeader = idx.email >= 0;

  const push = (row: ContactRow) => {
    if (byEmail.size >= IMPORT_MAX_ROWS) return;
    byEmail.set(row.email, { ...byEmail.get(row.email), ...row });
  };
  const splitName = (n: string | null): [string | null, string | null] => {
    if (!n) return [null, null];
    const parts = n.trim().split(/\s+/);
    return [parts[0] ?? null, parts.length > 1 ? parts.slice(1).join(" ") : null];
  };

  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitCsvLine(line);
    let email: string | null = null;
    let phone: string | null = null;
    let first: string | null = null;
    let last: string | null = null;

    if (hasHeader) {
      email = normalizeEmail(cells[idx.email] ?? "");
      phone = idx.phone >= 0 ? normalizeUsPhone(cells[idx.phone] ?? "") : null;
      first = idx.first >= 0 ? cells[idx.first] || null : null;
      last = idx.last >= 0 ? cells[idx.last] || null : null;
      if (!first && !last && idx.name >= 0) [first, last] = splitName(cells[idx.name] || null);
    } else {
      // "Name <email>", "email, Name", "Name, email", or just "email"
      const angle = line.match(/^(.*?)<([^>]+)>/);
      if (angle) {
        email = normalizeEmail(angle[2]);
        [first, last] = splitName(angle[1].replace(/["',]/g, "").trim() || null);
      } else {
        const e = cells.find((c) => EMAIL_RE.test(c));
        email = e ? normalizeEmail(e) : null;
        const rest = cells.filter((c) => c !== e && !EMAIL_RE.test(c));
        const p = rest.map((c) => normalizeUsPhone(c)).find(Boolean) ?? null;
        phone = p;
        const nameCell = rest.find((c) => !normalizeUsPhone(c) && /[a-z]/i.test(c)) ?? null;
        [first, last] = splitName(nameCell);
      }
    }

    if (!email) {
      skipped++;
      continue;
    }
    push({ email, phone, first_name: first ? first.slice(0, 80) : null, last_name: last ? last.slice(0, 80) : null });
  }
  const truncated = lines.length - (hasHeader ? 1 : 0) - skipped > IMPORT_MAX_ROWS;
  return { rows: [...byEmail.values()], skipped, truncated };
}

// ── Storage ──────────────────────────────────────────────────────────────────

const docId = (organizerId: string, email: string) => `${organizerId}:${email}`;

export type Contact = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  subscribed: boolean;
  source: string;
  created_at: number | null;
};

export async function importContacts(input: {
  organizerId: string;
  rows: ContactRow[];
  attestedBy: string; // organizer email
}): Promise<{ added: number; updated: number }> {
  const db = getDb();
  let added = 0;
  let updated = 0;
  for (let i = 0; i < input.rows.length; i += 400) {
    const chunk = input.rows.slice(i, i + 400);
    const refs = chunk.map((r) => db.collection(COLL).doc(docId(input.organizerId, r.email)));
    const existing = await db.getAll(...refs);
    const batch = db.batch();
    chunk.forEach((r, j) => {
      const snap = existing[j];
      if (snap.exists) {
        updated++;
        const d = snap.data()!;
        batch.update(refs[j], {
          phone: r.phone ?? d.phone ?? null,
          first_name: r.first_name ?? d.first_name ?? null,
          last_name: r.last_name ?? d.last_name ?? null,
          updated_at: FieldValue.serverTimestamp(),
        });
      } else {
        added++;
        batch.set(refs[j], {
          organizer_id: input.organizerId,
          email: r.email,
          phone: r.phone,
          first_name: r.first_name,
          last_name: r.last_name,
          subscribed: true,
          source: "import",
          unsub_token: randomBytes(18).toString("base64url"),
          attested_by: input.attestedBy,
          attested_at: FieldValue.serverTimestamp(),
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    });
    await batch.commit();
  }
  return { added, updated };
}

/**
 * Buyer-side opt-in ("Get updates from X"): the person gives their OWN consent
 * to hear from this organizer. Stored as a subscribed contact with source
 * "follow" plus the consent evidence; counts toward the announce-able audience.
 */
export async function followOrganizer(input: {
  organizerId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLL).doc(docId(input.organizerId, input.email));
  const snap = await ref.get();
  const consent = {
    subscribed: true,
    consented_at: FieldValue.serverTimestamp(),
    consent_ip: input.ip ?? null,
    consent_user_agent: input.userAgent ?? null,
    updated_at: FieldValue.serverTimestamp(),
  };
  if (snap.exists) {
    await ref.update(consent); // re-subscribes if they'd unsubscribed — their choice
    return;
  }
  await ref.set({
    organizer_id: input.organizerId,
    email: input.email,
    phone: null,
    first_name: null,
    last_name: null,
    source: "follow",
    unsub_token: randomBytes(18).toString("base64url"),
    created_at: FieldValue.serverTimestamp(),
    ...consent,
  });
}

export async function contactsSummary(organizerId: string): Promise<{ total: number; subscribed: number }> {
  const snap = await getDb().collection(COLL).where("organizer_id", "==", organizerId).get();
  return { total: snap.size, subscribed: snap.docs.filter((d) => d.data().subscribed !== false).length };
}

export async function listContacts(organizerId: string, max = 50): Promise<Contact[]> {
  const snap = await getDb().collection(COLL).where("organizer_id", "==", organizerId).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      const ts = x.created_at as { toMillis?: () => number } | undefined;
      return {
        id: d.id,
        email: x.email,
        phone: x.phone ?? null,
        first_name: x.first_name ?? null,
        last_name: x.last_name ?? null,
        subscribed: x.subscribed !== false,
        source: x.source ?? "import",
        created_at: ts?.toMillis ? ts.toMillis() : null,
      };
    })
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, max);
}

export async function deleteContact(organizerId: string, id: string): Promise<void> {
  if (!id.startsWith(`${organizerId}:`)) return; // never delete across organizers
  await getDb().collection(COLL).doc(id).delete();
}

export async function unsubscribeContactByToken(token: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection(COLL).where("unsub_token", "==", token).limit(1).get();
  if (snap.empty) return false;
  await snap.docs[0].ref.update({ subscribed: false, unsubscribed_at: FieldValue.serverTimestamp() });
  return true;
}

// ── Audience + announcements ─────────────────────────────────────────────────

export type AudienceMember = { email: string; first_name: string | null; kind: "contact" | "buyer"; unsub_token: string };

/**
 * Everyone an organizer may email: subscribed imported contacts, plus every
 * buyer of any of their events who opted into email updates. De-duplicated by
 * email (a buyer wins — their consent is the stronger one).
 */
export async function getOrganizerAudience(organizerId: string): Promise<AudienceMember[]> {
  const db = getDb();
  const out = new Map<string, AudienceMember>();

  const contacts = await db.collection(COLL).where("organizer_id", "==", organizerId).get();
  for (const d of contacts.docs) {
    const x = d.data();
    if (x.subscribed === false || !x.email) continue;
    out.set(x.email, { email: x.email, first_name: x.first_name ?? null, kind: "contact", unsub_token: x.unsub_token });
  }

  const events = await listEventsByOrganizer(organizerId);
  const phones = new Set<string>();
  for (const ev of events) {
    const orders = await db.collection("orders").where("event_id", "==", ev.id).get();
    orders.docs.forEach((o) => {
      if (o.data().status === "paid" && o.data().buyer_id) phones.add(o.data().buyer_id);
    });
  }
  if (phones.size > 0) {
    const refs = [...phones].map((p) => db.collection("buyers").doc(p));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const b = s.data()!;
      if (b.is_sample === true) continue; // seeded demo guests are not an audience
      if (!b.email || b.email_marketing_opt_in !== true) continue;
      const token = b.unsub_token ?? (await getOrCreateUnsubToken(s.id));
      if (!token) continue;
      out.set(b.email, { email: b.email, first_name: b.first_name ?? null, kind: "buyer", unsub_token: token });
    }
  }
  return [...out.values()];
}

export type AnnounceResult = { recipients: number; sent: number; failed: number; capped: boolean };

/** Email an event to the organizer's whole audience. Records an `announcements` doc. */
export async function announceEvent(input: {
  organizerId: string;
  eventId: string;
  subject: string;
  body: string;
}): Promise<AnnounceResult> {
  const db = getDb();
  const [organizer, event, audienceAll] = await Promise.all([
    getOrganizerById(input.organizerId),
    getEventById(input.eventId),
    getOrganizerAudience(input.organizerId),
  ]);
  if (!event || event.organizer_id !== input.organizerId) throw new Error("EVENT_NOT_FOUND");
  const organizerName = organizer?.name ?? "Your organizer";
  const capped = audienceAll.length > ANNOUNCE_MAX_RECIPIENTS;
  const audience = audienceAll.slice(0, ANNOUNCE_MAX_RECIPIENTS);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const eventUrl = `${site}/e/${event.slug}`;
  const whenText = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone,
  }).format(new Date(event.starts_at));

  const ref = db.collection("announcements").doc();
  await ref.set({
    organizer_id: input.organizerId,
    event_id: input.eventId,
    subject: input.subject,
    body: input.body,
    recipient_count: audience.length,
    status: "sending",
    created_at: FieldValue.serverTimestamp(),
  });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < audience.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(
      audience.slice(i, i + SEND_CONCURRENCY).map((m) =>
        sendAnnouncementEmail({
          to: m.email,
          firstName: m.first_name,
          organizerName,
          eventTitle: event.title,
          whenText,
          venue: [event.venue_name, event.city].filter(Boolean).join(", "),
          flyerUrl: event.flyer_url,
          subject: input.subject,
          body: input.body,
          eventUrl,
          reason: m.kind,
          unsubscribeUrl: `${site}/unsubscribe/${m.unsub_token}`,
        }).catch(() => ({ ok: false }))
      )
    );
    results.forEach((r) => (r.ok ? sent++ : failed++));
  }

  await ref.update({ status: "sent", sent, failed, sent_at: FieldValue.serverTimestamp() });
  return { recipients: audience.length, sent, failed, capped };
}

export type AnnouncementRecord = { id: string; event_id: string; subject: string; created_at: number; recipient_count: number; sent: number };

export async function listAnnouncements(organizerId: string, max = 5): Promise<AnnouncementRecord[]> {
  const snap = await getDb().collection("announcements").where("organizer_id", "==", organizerId).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      const ts = x.created_at as { toMillis?: () => number } | undefined;
      return { id: d.id, event_id: x.event_id, subject: x.subject ?? "", created_at: ts?.toMillis ? ts.toMillis() : 0, recipient_count: x.recipient_count ?? 0, sent: x.sent ?? 0 };
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, max);
}
