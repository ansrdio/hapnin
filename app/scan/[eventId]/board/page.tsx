import { notFound } from "next/navigation";
import Link from "next/link";
import { requireScanAccess } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getDoorStats } from "@/lib/door";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

// The number the person running the door actually wants: checked in / sold,
// live. Refreshes itself every 10s; scanner and box office stay one tap away.
function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" }).format(new Date(ms));
}

export default async function DoorBoard({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { organizer } = await requireScanAccess();
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const s = await getDoorStats(eventId);
  const pct = s.sold ? Math.round((s.checkedIn / s.sold) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <AutoRefresh seconds={10} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Door board · live</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-cream">{event.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/scan/${eventId}/board/screen`} target="_blank" className="rounded-lg border border-gold/50 px-3.5 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
            Big screen ↗
          </Link>
          <Link href={`/scan/${eventId}`} className="rounded-lg border border-plum-hi px-3.5 py-2 text-sm font-semibold text-cream hover:bg-plum">
            Scanner
          </Link>
          <Link href={`/scan/${eventId}/sell`} className="rounded-lg border border-plum-hi px-3.5 py-2 text-sm text-mauve-dim hover:text-cream">
            Box office
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-gold/30 bg-gold/[0.04] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Checked in</p>
        <p className="mt-1 font-display text-6xl font-bold tabular-nums text-cream">
          {s.checkedIn}
          <span className="text-3xl text-mauve-dim"> / {s.sold}</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-plum">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-mauve-dim">{pct}% of live tickets are in · {s.sold - s.checkedIn} still to come</p>
      </div>

      {s.byTier.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {s.byTier.map((t) => (
            <div key={t.name} className="rounded-2xl border border-plum-hi bg-plum/40 p-4">
              <p className="text-[11px] uppercase tracking-wide text-mauve-dim">{t.name}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-cream">
                {t.checkedIn}
                <span className="text-base text-mauve-dim"> / {t.sold}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mauve-dim">Latest through the door</p>
        {s.recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-plum-hi px-5 py-6 text-center text-sm text-mauve-dim">No one scanned yet.</p>
        ) : (
          <ul className="divide-y divide-plum-hi rounded-2xl border border-plum-hi">
            {s.recent.map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-cream">{r.name}</span>
                <span className="tabular-nums text-mauve-dim">{r.at ? fmtTime(r.at) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
