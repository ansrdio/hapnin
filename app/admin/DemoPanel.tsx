import Link from "next/link";
import { getDemoEvent, getDemoOrganizer, DEMO_ORGANIZER_NAME } from "@/lib/demo";
import { getTiers } from "@/lib/events";
import { Card, buttonClass, money } from "@/app/components/ui";
import { createDemoBrunchAction, resetDemoBrunchAction, deleteDemoBrunchAction } from "./actions";

// The organizer-meeting demo: "The Sunday Table", a women's cultural brunch,
// under the Hapnin Demo Organizer. Everything it creates is sample data
// (lib/demo.ts). Created, reset and deleted from here only.

const NOTICE: Record<string, string> = {
  created: "Demo created. The organizer dashboard is yours — sign in with the admin email and open /o.",
  exists: "The demo already exists; nothing was changed.",
  reset: "Demo reset: seeded check-ins restored, simulated orders removed.",
  deleted: "Demo event and all its sample data deleted. The Hapnin Demo Organizer record remains.",
};

export async function DemoPanel({ notice }: { notice?: string }) {
  const [organizer, event] = await Promise.all([getDemoOrganizer(), getDemoEvent()]);
  const tiers = event ? await getTiers(event.id) : [];
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.hapnin.now";
  const capacity = tiers.reduce((a, t) => a + t.quantity_total, 0);

  return (
    <section>
      <h1 className="font-display text-2xl font-semibold text-cream">Organizer demo</h1>
      <p className="mt-1 text-mauve-dim">
        A polished sample event for meetings: guest list, earnings, door board, scanner and a simulated buyer checkout. All of it is sample
        data — unlisted, unindexed, never published, never emailed, never in metrics.
      </p>
      {notice && NOTICE[notice] && (
        <p className="mt-4 rounded-xl border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-cream">{NOTICE[notice]}</p>
      )}

      {!event ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-cream">The Sunday Table — A Women’s Cultural Brunch</p>
              <p className="mt-1 text-sm text-mauve-dim">
                Creates {organizer ? "the event under" : "the organizer"} <span className="text-cream">{DEMO_ORGANIZER_NAME}</span>
                {organizer ? "" : " (owned by your admin email)"}, a Sunday six weeks out, 60 seats across three tiers, eight fictional orders.
              </p>
            </div>
            <form action={createDemoBrunchAction}>
              <button className={buttonClass("primary")}>Create demo event</button>
            </form>
          </div>
        </Card>
      ) : (
        <Card className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg font-semibold text-cream">{event.title}</p>
              <p className="mt-1 text-sm text-mauve-dim">
                {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.starts_at))}
                {" · "}
                {event.tickets_sold} sold of {capacity} · {event.checked_in} checked in · {money(event.gross_cents)} face value
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {tiers.map((t) => (
                  <li key={t.id} className="text-mauve-dim">
                    <span className="text-cream">{t.name}</span> · {money(t.price_cents)} · {t.quantity_sold}/{t.quantity_total} sold
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-end gap-2">
              <form action={resetDemoBrunchAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button className={buttonClass("secondary")}>Reset check-ins &amp; simulated orders</button>
              </form>
              <form action={deleteDemoBrunchAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button className={buttonClass("danger")}>Delete demo event</button>
              </form>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-plum-hi pt-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Attendee (phone)</p>
              <Link href={`/e/${event.slug}`} className="mt-1 block break-all text-sm text-cream hover:text-gold">{site}/e/{event.slug}</Link>
              <p className="mt-1 text-xs text-mauve-dim">Event page → Get tickets → simulated checkout → sample ticket with QR. Works signed out.</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Organizer (laptop)</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <Link href={`/o/events/${event.id}`} className="text-cream hover:text-gold">Overview</Link>
                <Link href={`/o/events/${event.id}/guests`} className="text-cream hover:text-gold">Guests</Link>
                <Link href={`/o/events/${event.id}/earnings`} className="text-cream hover:text-gold">Earnings</Link>
                <Link href={`/o/events/${event.id}/analytics`} className="text-cream hover:text-gold">Analytics</Link>
                <Link href={`/scan/${event.id}`} className="text-cream hover:text-gold">Scanner</Link>
                <Link href={`/scan/${event.id}/board`} className="text-cream hover:text-gold">Door board</Link>
              </div>
              <p className="mt-1 text-xs text-mauve-dim">
                Sign in as {organizer?.email ?? "the admin email"} — it owns {DEMO_ORGANIZER_NAME}, so /o opens this dashboard.
              </p>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
