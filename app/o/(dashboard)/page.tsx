import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { listEventsByOrganizer } from "@/lib/events";
import { refreshOnboardingStatus } from "@/lib/connect";
import { startOwnOnboardingAction, refreshOwnStripeStatusAction } from "@/app/o/actions";
import { PageHeader, LinkButton, Card, Stat, StatusBadge, EmptyState, buttonClass, money } from "@/app/components/ui";
import { EventList, CopyLinkButton } from "./EventList";

export const dynamic = "force-dynamic";

const PAST_GRACE_MS = 6 * 60 * 60 * 1000; // matches EventList: "upcoming" until 6h after doors

/** "today" / "tomorrow" / "in 12 days" / "happening now" for the Next-up card. */
function whenLabel(startsAt: number): string {
  const diff = startsAt - Date.now();
  if (diff <= 0) return "happening now";
  const days = diff / 86_400_000;
  if (days < 1) return "today";
  if (days < 2) return "tomorrow";
  return `in ${Math.ceil(days)} days`;
}

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

export default async function OrganizerHome({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; payout_error?: string }>;
}) {
  const { organizer, role } = await requireOrganizer();
  const { onboarding, payout_error } = await searchParams;
  const events = await listEventsByOrganizer(organizer.id);

  // Returning from Stripe onboarding: pull the live status so the indicator
  // flips to ✓ automatically instead of making the owner click "Refresh status".
  let justConnected = false;
  let stillVerifying = false;
  if (onboarding === "done" && role === "owner" && !organizer.stripe_onboarded && organizer.stripe_account_id) {
    try {
      const ready = await refreshOnboardingStatus(organizer.id);
      if (ready) {
        organizer.stripe_onboarded = true;
        justConnected = true;
      } else {
        stillVerifying = true;
      }
    } catch (err) {
      console.error("dashboard auto-refresh stripe status", err);
    }
  }

  const payoutsDone = organizer.stripe_onboarded;
  const createDone = events.length > 0;
  const publishDone = events.some((e) => e.status === "on_sale");
  const allSetUp = payoutsDone && createDone && publishDone;
  const firstToPublish = events.find((e) => e.status === "draft") ?? events[0];

  const totals = events.reduce(
    (a, e) => ({ sold: a.sold + e.tickets_sold, gross: a.gross + e.gross_cents }),
    { sold: 0, gross: 0 }
  );

  // "Next up": the soonest upcoming event — prefer one that's actually on sale.
  const now = Date.now();
  const upcoming = events
    .filter((e) => e.starts_at + PAST_GRACE_MS >= now && e.status !== "cancelled")
    .sort((a, b) => a.starts_at - b.starts_at);
  const next = upcoming.find((e) => e.status === "on_sale") ?? upcoming[0] ?? null;

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

      {payoutsDone && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald/40 bg-emerald/10 px-3.5 py-1.5 text-sm">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald text-[10px] text-ink">✓</span>
          <span className="font-medium text-cream">Payouts connected</span>
          <span className="text-mauve-dim">· sales pay out to your account</span>
        </div>
      )}

      {payout_error && (
        <Card className="mb-6 border-coral/50 bg-coral/10">
          <p className="font-display font-semibold text-cream">Couldn’t start Stripe onboarding.</p>
          <p className="mt-1 break-words text-sm text-mauve-dim">Stripe said: {payout_error}</p>
        </Card>
      )}

      {justConnected && (
        <Card className="mb-6 flex items-center gap-3 border-emerald/50 bg-emerald/10">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald text-ink">✓</span>
          <div>
            <p className="font-display font-semibold text-cream">Payouts connected.</p>
            <p className="mt-0.5 text-sm text-mauve-dim">
              Sales now land straight in your account. You’re ready to publish and sell.
            </p>
          </div>
        </Card>
      )}

      {stillVerifying && (
        <Card className="mb-6 border-gold/40 bg-gold/[0.06]">
          <p className="font-display font-semibold text-cream">Stripe is verifying your details.</p>
          <p className="mt-1 text-sm text-mauve-dim">
            This usually takes a minute. Hit “Refresh status” below once it’s done — you may also need to
            finish a step Stripe asked for.
          </p>
        </Card>
      )}

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

      {/* Next up — the one event an organizer checks every day, with the
          numbers and actions that matter right now. */}
      {next && (
        <Card className="mb-8 border-gold/30 bg-gold/[0.04]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              {next.flyer_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={next.flyer_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-plum text-2xl">🎟️</div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Next up · {whenLabel(next.starts_at)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <Link href={`/o/events/${next.id}`} className="font-display text-2xl font-bold text-cream hover:text-gold">
                    {next.title}
                  </Link>
                  <StatusBadge status={next.status} />
                </div>
                <p className="mt-0.5 text-sm text-mauve-dim">
                  {fmtDate(next.starts_at)} · {next.venue_name}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {next.status === "on_sale" ? (
                <CopyLinkButton slug={next.slug} label="Copy event link" className={buttonClass("primary")} />
              ) : (
                <LinkButton href={`/o/events/${next.id}`} variant="primary">Publish</LinkButton>
              )}
              <LinkButton href={`/o/events/${next.id}/guests`} variant="secondary">Guest list</LinkButton>
              <LinkButton href={`/o/events/${next.id}`} variant="secondary">Manage</LinkButton>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <Stat
              label="Sold"
              value={next.capacity != null ? `${next.tickets_sold}/${next.capacity}` : next.tickets_sold}
              sub={next.capacity != null ? `${Math.max(0, next.capacity - next.tickets_sold)} left` : undefined}
            />
            <Stat label="Gross" value={money(next.gross_cents)} />
            <Stat label="Checked in" value={next.checked_in} sub={`of ${next.tickets_sold}`} />
          </div>
        </Card>
      )}

      {events.length > 1 && (
        <div className="mb-8 grid grid-cols-3 gap-4">
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
        <EventList
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            slug: e.slug,
            status: e.status,
            starts_at: e.starts_at,
            venue_name: e.venue_name,
            tickets_sold: e.tickets_sold,
            gross_cents: e.gross_cents,
            capacity: e.capacity,
            flyer_url: e.flyer_url,
          }))}
        />
      )}
    </div>
  );
}
