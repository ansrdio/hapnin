import { requireOrganizer } from "@/lib/auth";
import { listEventsByOrganizer } from "@/lib/events";
import { contactsSummary, listContacts, getOrganizerAudience, listAnnouncements } from "@/lib/contacts";
import { deleteContactAction } from "@/app/o/actions";
import { PageHeader, Card, Stat, EmptyState } from "@/app/components/ui";
import { ImportForm } from "./ImportForm";
import { AnnounceForm } from "./AnnounceForm";

export const dynamic = "force-dynamic";

const UPCOMING_GRACE_MS = 6 * 60 * 60 * 1000;

function fmtWhen(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz,
  }).format(new Date(ms));
}

// The organizer's audience: the list they bring + everyone who bought from
// them and opted in. Email only; phones are never texted from an import.
export default async function AudiencePage() {
  const { organizer } = await requireOrganizer();
  const [summary, contacts, audience, events, history] = await Promise.all([
    contactsSummary(organizer.id),
    listContacts(organizer.id, 50),
    getOrganizerAudience(organizer.id),
    listEventsByOrganizer(organizer.id),
    listAnnouncements(organizer.id),
  ]);
  const buyersOptedIn = audience.filter((a) => a.kind === "buyer").length;
  const now = Date.now();
  const announceable = events
    .filter((e) => e.status === "on_sale" && e.starts_at + UPCOMING_GRACE_MS > now)
    .sort((a, b) => a.starts_at - b.starts_at)
    .map((e) => ({ id: e.id, title: e.title, whenText: fmtWhen(e.starts_at, e.timezone), url: `https://hapnin.now/e/${e.slug}` }));
  const titleOf = (id: string) => events.find((e) => e.id === id)?.title ?? "—";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Audience"
        back={{ href: "/o", label: "Your events" }}
        subtitle="Everyone you can email: the list you bring, plus people who bought from you and opted in."
      />

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="Reachable" value={audience.length} sub="by email" />
        <Stat label="Imported" value={summary.subscribed} sub={summary.total > summary.subscribed ? `${summary.total - summary.subscribed} unsubscribed` : "contacts"} />
        <Stat label="Buyers opted in" value={buyersOptedIn} sub="from your events" />
      </div>

      <Card className="mb-6">
        <p className="font-display font-semibold text-cream">Announce an event</p>
        <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
          One email to your whole audience — from your name, with the flyer, and a one-click unsubscribe on every copy.
        </p>
        {announceable.length === 0 ? (
          <p className="text-sm text-mauve-dim">Publish an event first, then announce it here.</p>
        ) : (
          <AnnounceForm events={announceable} audienceSize={audience.length} />
        )}
      </Card>

      <Card className="mb-6">
        <p className="font-display font-semibold text-cream">Import contacts</p>
        <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
          Paste emails (one per line, names optional) or upload a CSV — Eventbrite exports work as-is. Phones are
          kept only to recognise people at checkout and the door; <span className="text-cream">we never text an imported
          number</span> — texting needs the person&rsquo;s own opt-in.
        </p>
        <ImportForm />
      </Card>

      {history.length > 0 && (
        <Card className="mb-6">
          <p className="mb-3 font-display font-semibold text-cream">Sent</p>
          <ul className="divide-y divide-plum-hi">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="text-cream">
                  {a.subject} <span className="text-mauve-dim">· {titleOf(a.event_id)}</span>
                </span>
                <span className="text-mauve-dim">
                  {a.sent} of {a.recipient_count} · {a.created_at ? fmtWhen(a.created_at, "America/Phoenix") : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {contacts.length === 0 ? (
        <EmptyState title="No imported contacts yet">
          Bring the list you already have — a spreadsheet, an Eventbrite export, the people who always ask
          &ldquo;when&rsquo;s the next one?&rdquo;
        </EmptyState>
      ) : (
        <Card>
          <p className="mb-3 font-display font-semibold text-cream">
            Contacts <span className="text-mauve-dim">· latest {contacts.length}{summary.total > contacts.length ? ` of ${summary.total}` : ""}</span>
          </p>
          <ul className="divide-y divide-plum-hi">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-cream">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}
                    {!c.subscribed && <span className="ml-2 text-xs uppercase tracking-wide text-coral">unsubscribed</span>}
                  </p>
                  {(c.first_name || c.last_name) && <p className="truncate text-mauve-dim">{c.email}</p>}
                </div>
                <form action={deleteContactAction}>
                  <input type="hidden" name="contact_id" value={c.id} />
                  <button className="text-xs text-mauve-dim hover:text-coral">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
