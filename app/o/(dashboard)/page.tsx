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

function Step({
  n,
  done,
  title,
  desc,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  desc?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-emerald text-ink" : "border border-plum-hi text-mauve-dim"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1">
        <p className={`font-display font-semibold ${done ? "text-mauve-dim line-through" : "text-cream"}`}>{title}</p>
        {desc && <p className="mt-0.5 text-sm text-mauve-dim">{desc}</p>}
        {!done && children && <div className="mt-2.5">{children}</div>}
      </div>
    </li>
  );
}

export default async function OrganizerHome({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const { organizer, role } = await requireOrganizer();
  const { onboarding } = await searchParams;
  const events = await listEventsByOrganizer(organizer.id);

  const payoutsDone = organizer.stripe_onboarded;
  const createDone = events.length > 0;
  const publishDone = events.some((e) => e.status === "on_sale");
  const allSetUp = payoutsDone && createDone && publishDone;
  const firstToPublish = events.find((e) => e.status === "draft") ?? events[0];

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

      {!allSetUp && (
        <Card className="mb-8 border-gold/30 bg-gold/[0.04]">
          <p className="font-display text-lg font-semibold text-cream">Get set up</p>
          <p className="mt-0.5 text-sm text-mauve-dim">Four steps to your first sale.</p>
          <ol className="mt-6 space-y-5">
            <Step
              n={1}
              done={payoutsDone}
              title="Connect payouts"
              desc="Money from sales lands straight in your own account. ~2 minutes."
            >
              {role === "owner" ? (
                onboarding === "done" ? (
                  <form action={refreshOwnStripeStatusAction}>
                    <button className={buttonClass("primary")}>Refresh status</button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-3">
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
                )
              ) : (
                <p className="text-sm text-mauve-dim">Ask the account owner to connect payouts.</p>
              )}
            </Step>

            <Step n={2} done={createDone} title="Create an event" desc="Add your flyer, tiers, and details.">
              <LinkButton href="/o/events/new" variant="primary">+ New event</LinkButton>
            </Step>

            <Step n={3} done={publishDone} title="Publish it" desc="Flip it on sale so people can buy.">
              {createDone && firstToPublish && (
                <LinkButton href={`/o/events/${firstToPublish.id}`} variant="secondary">
                  Open &amp; publish
                </LinkButton>
              )}
            </Step>

            <Step
              n={4}
              done={false}
              title="Share your link"
              desc={<>Post it everywhere: <span className="text-cream">hapnin.now/o/{organizer.handle}</span></>}
            >
              {publishDone && (
                <Link href={`/o/${organizer.handle}`} target="_blank" className={buttonClass("secondary")}>
                  View public page ↗
                </Link>
              )}
            </Step>
          </ol>
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
