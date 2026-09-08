import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { listEventsByOrganizer } from "@/lib/events";
import { startOwnOnboardingAction, refreshOwnStripeStatusAction } from "@/app/o/actions";
import { PageHeader, LinkButton, Card, Stat, StatusBadge, EmptyState, buttonClass, money } from "@/app/components/ui";

export const dynamic = "force-dynamic";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function OrganizerHome({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const { organizer, role } = await requireOrganizer();
  const { onboarding } = await searchParams;
  const events = await listEventsByOrganizer(organizer.id);

  const totals = events.reduce(
    (a, e) => ({ sold: a.sold + e.tickets_sold, gross: a.gross + e.gross_cents }),
    { sold: 0, gross: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Your events"
        subtitle={
          <>
            Public page: <span className="text-cream">hapnin.now/o/{organizer.handle}</span>
          </>
        }
        action={<LinkButton href="/o/events/new">+ New event</LinkButton>}
      />

      {!organizer.stripe_onboarded && (
        <Card className="mb-8 border-gold/40 bg-gold/5">
          {onboarding === "done" ? (
            <>
              <p className="font-display font-semibold text-cream">Back from Stripe — almost there.</p>
              <p className="mt-1 text-sm text-mauve-dim">Tap refresh to confirm your payouts are live.</p>
              <form action={refreshOwnStripeStatusAction} className="mt-4">
                <button className={buttonClass("secondary")}>Refresh status</button>
              </form>
            </>
          ) : (
            <>
              <p className="font-display font-semibold text-cream">Connect payouts to start selling.</p>
              <p className="mt-1 text-sm text-mauve-dim">
                Build events now — but tickets can’t sell until your Stripe payouts are connected. Takes about
                two minutes, and money from sales lands straight in your own account.
              </p>
              {role === "owner" ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={startOwnOnboardingAction}>
                    <button className={buttonClass("primary")}>
                      {organizer.stripe_account_id ? "Finish connecting Stripe" : "Connect payouts"}
                    </button>
                  </form>
                  {organizer.stripe_account_id && (
                    <form action={refreshOwnStripeStatusAction}>
                      <button className={buttonClass("secondary")}>Refresh status</button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-mauve-dim">Ask the account owner to connect payouts.</p>
              )}
            </>
          )}
        </Card>
      )}

      {events.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Events" value={events.length} />
          <Stat label="Tickets sold" value={totals.sold} />
          <Stat label="Gross" value={money(totals.gross)} />
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState title="No events yet">
          Create your first event — add tiers, publish it, and share the link. You can save a draft first
          and publish when you’re ready.
          <div className="mt-4">
            <LinkButton href="/o/events/new">+ New event</LinkButton>
          </div>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const cap = e.capacity ?? null;
            return (
              <li key={e.id}>
                <Link
                  href={`/o/events/${e.id}`}
                  className="block rounded-2xl border border-plum-hi bg-plum/40 p-5 transition-colors hover:border-gold"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      {e.flyer_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.flyer_url}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-display text-lg font-semibold text-cream">{e.title}</span>
                          <StatusBadge status={e.status} />
                        </div>
                        <p className="mt-0.5 text-sm text-mauve-dim">
                          {fmtDate(e.starts_at)} · {e.venue_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="font-display text-lg font-semibold tabular-nums text-cream">
                          {e.tickets_sold}
                          {cap != null && <span className="text-mauve-dim">/{cap}</span>}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-mauve-dim">Sold</div>
                      </div>
                      <div>
                        <div className="font-display text-lg font-semibold tabular-nums text-cream">{money(e.gross_cents)}</div>
                        <div className="text-[11px] uppercase tracking-wide text-mauve-dim">Gross</div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
