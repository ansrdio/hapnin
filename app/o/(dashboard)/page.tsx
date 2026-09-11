import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { listEventsByOrganizer } from "@/lib/events";
import { refreshOnboardingStatus } from "@/lib/connect";
import { startOwnOnboardingAction, refreshOwnStripeStatusAction, createSampleEventAction } from "@/app/o/actions";
import { listTeamMembers } from "@/lib/team";
import { EVENT_TEMPLATES } from "@/lib/templates";
import { PageHeader, LinkButton, Card, Stat, StatusBadge, EmptyState, buttonClass, money } from "@/app/components/ui";
import { EventList, CopyLinkButton } from "./EventList";

export const dynamic = "force-dynamic";

// Three quick-start tiles on the checklist; the builder has the full set.
const QUICK_TEMPLATES = EVENT_TEMPLATES.filter((t) => ["afrobeats-night", "amapiano-day-party", "free-rsvp"].includes(t.id));

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

const smallBtn =
  "inline-flex items-center rounded-lg border border-plum-hi bg-plum/40 px-2.5 py-1.5 text-xs font-semibold text-cream transition-colors hover:border-gold";

// One line per step; only the step you're on (first undone) opens up with its
// hint and buttons, so the sidebar stays short.
function SideStep({
  n,
  done,
  active,
  title,
  desc,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? "bg-emerald text-ink" : active ? "bg-gold text-ink" : "border border-plum-hi text-mauve-dim"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-display font-semibold ${done ? "text-mauve-dim/70 line-through" : active ? "text-cream" : "text-mauve-dim"}`}>{title}</p>
        {active && desc && <p className="mt-0.5 text-xs leading-relaxed text-mauve-dim">{desc}</p>}
        {active && children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

export default async function OrganizerHome({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string; payout_error?: string; sample?: string }>;
}) {
  const { organizer, role } = await requireOrganizer();
  const { onboarding, payout_error, sample: sampleParam } = await searchParams;
  const sampleDeleted = sampleParam === "deleted";
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

  // The checklist reads real events only; the sample is a playground.
  const real = events.filter((e) => !e.is_sample);
  const sample = events.find((e) => e.is_sample) ?? null;
  const team = await listTeamMembers(organizer.id).catch(() => []);
  const payoutsDone = organizer.stripe_onboarded;
  const createDone = real.length > 0;
  const publishDone = real.some((e) => e.status === "on_sale");
  const soldDone = real.some((e) => e.tickets_sold > 0);
  const doorDone = real.some((e) => e.checked_in > 0);
  const teamDone = team.length > 0;
  const steps = [createDone, publishDone, soldDone, doorDone, payoutsDone, teamDone];
  const doneCount = steps.filter(Boolean).length;
  const allSetUp = doneCount === steps.length;
  const nextStep = steps.findIndex((d) => !d) + 1; // 1-based; 0 when all done
  const firstToPublish = real.find((e) => e.status === "draft") ?? real[0];
  const firstLive = real.find((e) => e.status === "on_sale");

  const totals = real.reduce(
    (a, e) => ({ sold: a.sold + e.tickets_sold, gross: a.gross + e.gross_cents }),
    { sold: 0, gross: 0 }
  );

  // "Next up": the soonest upcoming event — prefer one that's actually on sale.
  const now = Date.now();
  const upcoming = real
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

      {sampleDeleted && (
        <Card className="mb-6 border-emerald/50 bg-emerald/10">
          <p className="font-display font-semibold text-cream">Sample event removed.</p>
          <p className="mt-0.5 text-sm text-mauve-dim">All of its made-up guests, orders and tickets went with it.</p>
        </Card>
      )}

      {/* Main column + the setup checklist as a slim sidebar (below on phones). */}
      <div className={allSetUp ? "" : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_272px] lg:items-start"}>
        <div className="min-w-0">
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

          {real.length > 1 && (
            <div className="mb-8 grid grid-cols-3 gap-4">
              <Stat label="Events" value={real.length} />
              <Stat label="Tickets sold" value={totals.sold} />
              <Stat label="Gross" value={money(totals.gross)} />
            </div>
          )}

          {events.length === 0 ? (
            <EmptyState title="Your first event">
              Start from a template — tiers, pricing and the blurb filled in for the kind of night it is — or from
              scratch. Nothing is live until you publish.
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((t) => (
                  <Link key={t.id} href={`/o/events/new?template=${t.id}`} className={buttonClass("secondary")}>
                    {t.emoji} {t.name}
                  </Link>
                ))}
                <LinkButton href="/o/events/new">+ New event</LinkButton>
              </div>
              <form action={createSampleEventAction} className="mt-4">
                <button className="text-sm text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-hi">
                  Or explore with a sample event first — made-up guests, real screens
                </button>
              </form>
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

        {!allSetUp && (
          <aside className="rounded-2xl border border-gold/30 bg-gold/[0.04] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-semibold text-cream">Get set up</p>
              <p className="text-xs text-mauve-dim">{doneCount} of {steps.length}</p>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-plum">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-4 space-y-3">
              <SideStep n={1} done={createDone} active={nextStep === 1} title="Create your event" desc="Start from a template. Three minutes.">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map((t) => (
                    <Link key={t.id} href={`/o/events/new?template=${t.id}`} className={smallBtn}>
                      {t.emoji} {t.name}
                    </Link>
                  ))}
                </div>
              </SideStep>
              <SideStep n={2} done={publishDone} active={nextStep === 2} title="Publish it" desc="Free RSVP events go live straight away; paid ones need payouts connected.">
                {firstToPublish && <Link href={`/o/events/${firstToPublish.id}`} className={smallBtn}>Open &amp; publish</Link>}
              </SideStep>
              <SideStep n={3} done={soldDone} active={nextStep === 3} title="Get the first ticket out" desc="Copy the link, post the story, print the QR poster.">
                {firstLive && (
                  <div className="flex flex-wrap gap-1.5">
                    <CopyLinkButton slug={firstLive.slug} label="Copy link" className={smallBtn} />
                    <Link href={`/o/poster/${firstLive.id}`} target="_blank" className={smallBtn}>QR poster ↗</Link>
                  </div>
                )}
              </SideStep>
              <SideStep n={4} done={doorDone} active={nextStep === 4} title="Run the door" desc="Scan from any phone — works offline. Put the live board on a screen.">
                {(firstLive ?? sample) && (
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/scan/${(firstLive ?? sample)!.id}`} className={smallBtn}>Scanner</Link>
                    <Link href={`/scan/${(firstLive ?? sample)!.id}/board`} className={smallBtn}>Door board</Link>
                  </div>
                )}
              </SideStep>
              <SideStep n={5} done={payoutsDone} active={nextStep === 5} title="Connect payouts" desc="Paid tickets land in your own account. ~2 minutes. Not needed for free events.">
                {role === "owner" ? (
                  onboarding === "done" ? (
                    <form action={refreshOwnStripeStatusAction}><button className={smallBtn}>Refresh status</button></form>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      <form action={startOwnOnboardingAction}>
                        <button className={smallBtn}>{organizer.stripe_account_id ? "Finish Stripe" : "Connect"}</button>
                      </form>
                      {organizer.stripe_account_id && (
                        <form action={refreshOwnStripeStatusAction}><button className={smallBtn}>Refresh</button></form>
                      )}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-mauve-dim">Ask the account owner.</p>
                )}
              </SideStep>
              <SideStep n={6} done={teamDone} active={nextStep === 6} title="Add your door team" desc="Their own scanner login — no access to money or settings.">
                {role === "owner" && <Link href="/o/team" className={smallBtn}>Add team</Link>}
              </SideStep>
            </ol>
            <div className="mt-4 border-t border-plum-hi pt-3 text-xs text-mauve-dim">
              {!sample ? (
                <form action={createSampleEventAction}>
                  <button className="text-left text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-hi">
                    Explore with a sample event
                  </button>
                  <span> — made-up guests, real screens.</span>
                </form>
              ) : (
                <>Sample event in your list — <Link href={`/o/events/${sample.id}`} className="text-gold hover:underline">open it</Link>.</>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
