"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, money } from "@/app/components/ui";
import { duplicateEventAction } from "@/app/o/actions";

// The organizer's event list. Client-side so search and the Upcoming/Past split
// are instant, and so each card carries the jobs an organizer actually does
// day-to-day (share the link, open the door list, scan) as one-tap actions
// instead of a click-through to the manage page.

export type EventCard = {
  id: string;
  title: string;
  slug: string;
  status: string;
  starts_at: number;
  venue_name: string;
  tickets_sold: number;
  gross_cents: number;
  capacity: number | null;
  flyer_url: string | null;
};

const PAST_GRACE_MS = 6 * 60 * 60 * 1000; // an event stays "upcoming" for 6h after doors

export function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function publicUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://hapnin.now";
  return `${origin}/e/${slug}`;
}

export function CopyLinkButton({ slug, className, label = "Share link" }: { slug: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(publicUrl(slug));
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy your event link:", publicUrl(slug));
        }
      }}
      className={
        className ??
        "rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
      }
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

const actionClass = "rounded-lg border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim transition-colors hover:border-gold hover:text-cream";

function EventRow({ e }: { e: EventCard }) {
  const cap = e.capacity ?? null;
  const left = cap != null ? Math.max(0, cap - e.tickets_sold) : null;
  const onSale = e.status === "on_sale";
  return (
    <li className="rounded-2xl border border-plum-hi bg-plum/40 p-5 transition-colors hover:border-plum-hi/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          {e.flyer_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.flyer_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-plum text-xl">🎟️</div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link href={`/o/events/${e.id}`} className="truncate font-display text-lg font-semibold text-cream hover:text-gold">
                {e.title}
              </Link>
              <StatusBadge status={e.status} />
            </div>
            <p className="mt-0.5 text-sm text-mauve-dim">
              {fmtWhen(e.starts_at)} · {e.venue_name}
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="font-display text-lg font-semibold tabular-nums text-cream">
              {e.tickets_sold}
              {cap != null && <span className="text-mauve-dim">/{cap}</span>}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-mauve-dim">{left != null ? `${left} left` : "Sold"}</div>
          </div>
          <div>
            <div className="font-display text-lg font-semibold tabular-nums text-cream">{money(e.gross_cents)}</div>
            <div className="text-[11px] uppercase tracking-wide text-mauve-dim">Gross</div>
          </div>
        </div>
      </div>

      {/* Quick actions — the things an organizer does most, one tap away. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {onSale ? (
          <CopyLinkButton slug={e.slug} />
        ) : (
          <Link href={`/o/events/${e.id}`} className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/10">
            {e.status === "draft" ? "Publish" : "Manage"}
          </Link>
        )}
        <Link href={`/o/events/${e.id}/guests`} className={actionClass}>
          Guest list{e.tickets_sold > 0 ? ` · ${e.tickets_sold}` : ""}
        </Link>
        <Link href={`/scan/${e.id}`} className={actionClass}>
          Scan
        </Link>
        <Link href={`/o/events/${e.id}`} className={actionClass}>
          Manage
        </Link>
        <form action={duplicateEventAction}>
          <input type="hidden" name="event_id" value={e.id} />
          <button type="submit" className={actionClass} title="Copy as a new draft one week later">
            Duplicate
          </button>
        </form>
      </div>
    </li>
  );
}

export function EventList({ events }: { events: EventCard[] }) {
  const [q, setQ] = useState("");
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const needle = q.trim().toLowerCase();
    const match = (e: EventCard) =>
      !needle || e.title.toLowerCase().includes(needle) || e.venue_name.toLowerCase().includes(needle);
    const up = events.filter((e) => e.starts_at + PAST_GRACE_MS >= now && match(e)).sort((a, b) => a.starts_at - b.starts_at);
    const pa = events.filter((e) => e.starts_at + PAST_GRACE_MS < now && match(e)).sort((a, b) => b.starts_at - a.starts_at);
    return { upcoming: up, past: pa };
  }, [events, q]);

  return (
    <div className="space-y-6">
      {events.length > 3 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events by name or venue…"
          className="w-full rounded-xl border border-plum-hi bg-ink/50 px-4 py-3 text-cream placeholder:text-mauve-dim/50 outline-none transition-colors focus:border-gold"
        />
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Upcoming <span className="text-mauve-dim">· {upcoming.length}</span>
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-plum-hi px-5 py-6 text-center text-sm text-mauve-dim">
            {q ? "No upcoming events match." : "Nothing upcoming — create your next event."}
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((s) => !s)}
            className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-mauve-dim hover:text-cream"
            aria-expanded={showPast}
          >
            <span className={`transition-transform ${showPast ? "rotate-90" : ""}`}>▸</span>
            Past <span>· {past.length}</span>
          </button>
          {showPast && (
            <ul className="space-y-3 opacity-80">
              {past.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
