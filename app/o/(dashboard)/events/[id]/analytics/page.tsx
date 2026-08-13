import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getEventAnalytics, type Bar } from "@/lib/analytics";
import { listPromoterLinks } from "@/lib/promoters";
import { PageHeader, Card, Stat, money } from "@/app/components/ui";

export const dynamic = "force-dynamic";

function BarList({ title, bars, showGross = true }: { title: string; bars: Bar[]; showGross?: boolean }) {
  const max = Math.max(1, ...bars.map((b) => b.tickets));
  return (
    <Card>
      <p className="mb-4 font-display font-semibold text-cream">{title}</p>
      {bars.length === 0 ? (
        <p className="text-sm text-mauve-dim">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize text-cream">{b.label}</span>
                <span className="tabular-nums text-mauve-dim">
                  {b.tickets} {showGross && `· ${money(b.gross_cents)}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(b.tickets / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();

  const [a, promoters] = await Promise.all([getEventAnalytics(id), listPromoterLinks(id)]);
  const checkinRate = a.totalTickets > 0 ? Math.round((a.checkedIn / a.totalTickets) * 100) : 0;
  const topPromoters = promoters.filter((p) => p.tickets_count > 0).sort((x, y) => y.tickets_count - x.tickets_count);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Analytics" subtitle={event.title} back={{ href: `/o/events/${id}`, label: event.title }} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Gross" value={money(a.gross_cents)} />
        <Stat label="Tickets" value={a.tickets} sub={`${a.orders} orders`} />
        <Stat label="Checked in" value={`${checkinRate}%`} sub={`${a.checkedIn}/${a.totalTickets}`} />
        <Stat label="Refunds" value={a.refunds} />
      </div>

      <div className="space-y-6">
        <BarList title="Sales by day" bars={a.byDay} />
        <div className="grid gap-6 sm:grid-cols-2">
          <BarList title="By tier" bars={a.byTier} />
          <BarList title="By channel" bars={a.byChannel} showGross={false} />
        </div>
        <BarList title="How they found it" bars={a.bySource} showGross={false} />

        {topPromoters.length > 0 && (
          <Card>
            <p className="mb-4 font-display font-semibold text-cream">Top promoters</p>
            <ul className="divide-y divide-plum-hi">
              {topPromoters.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span className="text-cream">{p.name}</span>
                  <span className="text-sm tabular-nums text-mauve-dim">
                    {p.tickets_count} · {money(p.gross_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
