import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { audienceSummary, listBroadcasts } from "@/lib/broadcasts";
import { listPromoterLinks } from "@/lib/promoters";
import { listPromoCodes } from "@/lib/promos";
import { waitlistCount } from "@/lib/waitlist";
import { isSmsConfigured } from "@/lib/sms";
import { setEventStatusAction, setEventFlyerAction, notifyWaitlistAction, duplicateEventAction } from "@/app/o/actions";
import { FlyerUpload } from "@/app/components/FlyerUpload";
import {
  PageHeader,
  Card,
  Stat,
  StatusBadge,
  LinkButton,
  buttonClass,
  money,
} from "@/app/components/ui";
import { ShareLink } from "./ShareLink";
import { DeleteEventButton } from "./DeleteEventButton";
import { CompForm } from "./CompForm";
import { BroadcastForm } from "./BroadcastForm";
import { PromoterLinks } from "./PromoterLinks";
import { PromoCodes } from "./PromoCodes";
import { TableManager } from "./TableManager";
import { SectionTabs, TabPanel } from "./SectionTabs";

export const dynamic = "force-dynamic";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusButton({ eventId, status, label, variant }: { eventId: string; status: string; label: string; variant: "primary" | "secondary" | "danger" }) {
  return (
    <form action={setEventStatusAction}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="status" value={status} />
      <button className={buttonClass(variant)}>{label}</button>
    </form>
  );
}

export default async function ManageEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const tiers = await getTiers(id);
  const gaTiers = tiers.filter((t) => t.kind !== "table");
  const tableTiers = tiers.filter((t) => t.kind === "table");
  const [audience, broadcastHistory] = await Promise.all([audienceSummary(id), listBroadcasts(id)]);
  const promoterLinks = await listPromoterLinks(id);
  const promoCodes = await listPromoCodes(id);
  const waitlist = await waitlistCount(id);

  const capacity = event.capacity ?? tiers.reduce((a, t) => a + t.quantity_total, 0);
  const remaining = Math.max(0, capacity - event.tickets_sold);
  const publicUrl = `https://hapnin.now/e/${event.slug}`;
  const smsOff = !isSmsConfigured();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={event.title}
        back={{ href: "/o", label: "Your events" }}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={event.status} /> · {fmtDate(event.starts_at)}
          </span>
        }
        action={
          <div className="flex gap-2">
            <LinkButton href={`/o/events/${event.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <LinkButton href={`/o/events/${event.id}/analytics`} variant="secondary">
              Analytics
            </LinkButton>
            <LinkButton href={`/o/events/${event.id}/earnings`} variant="secondary">
              Earnings
            </LinkButton>
            {event.status === "on_sale" && (
              <LinkButton href={`/e/${event.slug}`} variant="secondary" target="_blank">
                View ↗
              </LinkButton>
            )}
          </div>
        }
      />

      {/* Payouts not connected → this event can't actually sell */}
      {!organizer.stripe_onboarded && (
        <Card className="mb-6 border-coral/50 bg-coral/10">
          <p className="font-display font-semibold text-cream">Buyers can’t check out yet.</p>
          <p className="mt-1 text-sm text-mauve-dim">
            {event.status === "on_sale"
              ? "This event is published, but tickets won’t sell until your payouts are connected — the money needs somewhere to land."
              : "Connect your payouts before you publish, so tickets can sell the moment you go live."}
          </p>
          <LinkButton href="/o" variant="primary" className="mt-4">
            Connect payouts
          </LinkButton>
        </Card>
      )}

      {/* Publish controls — always visible, above the tabs */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {event.status === "draft" && (
            <>
              <StatusButton eventId={event.id} status="on_sale" label="Publish — go on sale" variant="primary" />
              <span className="text-sm text-mauve-dim">Draft — not visible to buyers yet.</span>
            </>
          )}
          {event.status === "on_sale" && (
            <>
              <StatusButton eventId={event.id} status="draft" label="Unpublish" variant="secondary" />
              <StatusButton eventId={event.id} status="cancelled" label="Cancel event" variant="danger" />
            </>
          )}
          {event.status === "cancelled" && (
            <StatusButton eventId={event.id} status="draft" label="Reopen as draft" variant="secondary" />
          )}
          {event.status === "sold_out" && (
            <StatusButton eventId={event.id} status="on_sale" label="Reopen sales" variant="secondary" />
          )}
        </div>
      </Card>

      <SectionTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "tickets", label: "Tickets & tables", count: gaTiers.length + tableTiers.length },
          { id: "promotion", label: "Promotion", count: promoCodes.length + promoterLinks.length },
          { id: "guests", label: "Guests", count: event.tickets_sold },
        ]}
      >
        {/* ── Overview: the numbers, the link, the flyer ─────────────────── */}
        <TabPanel id="overview">
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sold" value={event.tickets_sold} sub={`${remaining} left`} />
            <Stat label="Gross" value={money(event.gross_cents)} />
            <Stat label="Checked in" value={event.checked_in} sub={`of ${event.tickets_sold}`} />
            <Stat label="Capacity" value={capacity} />
          </div>

          <Card className="mb-6">
            <p className="mb-1 font-display font-semibold text-cream">Your event link</p>
            <p className="mb-4 text-sm text-mauve-dim">
              {event.status === "on_sale" ? "Post it everywhere — this is where people buy." : "Goes live when you publish."}
            </p>
            <ShareLink url={publicUrl} disabled={event.status !== "on_sale"} />
            {event.status === "on_sale" && (
              <div className="mt-3">
                <LinkButton href={`/e/${event.slug}`} variant="ghost" target="_blank">
                  Preview the event page ↗
                </LinkButton>
              </div>
            )}
          </Card>

          <Card className="mb-6">
            <p className="mb-4 font-display font-semibold text-cream">Flyer</p>
            <form action={setEventFlyerAction} className="space-y-4">
              <input type="hidden" name="event_id" value={event.id} />
              <FlyerUpload initialUrl={event.flyer_url ?? ""} />
              <button className={buttonClass("secondary")}>Save flyer</button>
            </form>
          </Card>

          {/* Run it again — the weekly-night button */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display font-semibold text-cream">Run it again</p>
                <p className="mt-0.5 text-sm text-mauve-dim">
                  Copy this event — flyer, tiers, tables, refund policy — as a new draft one week later. You set
                  the date, then publish.
                </p>
              </div>
              <form action={duplicateEventAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button className={buttonClass("secondary")}>Duplicate event</button>
              </form>
            </div>
          </Card>

          {/* Danger zone — delete only allowed before any sales */}
          {event.tickets_sold === 0 && (
            <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-coral/20 p-5">
              <div>
                <p className="font-display font-semibold text-cream">Delete this event</p>
                <p className="text-sm text-mauve-dim">Only possible before any tickets sell.</p>
              </div>
              <DeleteEventButton eventId={event.id} title={event.title} />
            </div>
          )}
        </TabPanel>

        {/* ── Tickets & tables ───────────────────────────────────────────── */}
        <TabPanel id="tickets">
          <Card className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-display font-semibold text-cream">Tiers</p>
              <LinkButton href={`/o/events/${event.id}/edit`} variant="ghost">
                Edit tiers
              </LinkButton>
            </div>
            <div className="divide-y divide-plum-hi">
              {gaTiers.map((t) => {
                const left = Math.max(0, t.quantity_total - t.quantity_sold);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium text-cream">{t.name}</p>
                      <p className="text-sm text-mauve-dim">{money(t.price_cents)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-semibold tabular-nums text-cream">
                        {t.quantity_sold}
                        <span className="text-mauve-dim">/{t.quantity_total}</span>
                      </p>
                      <p className="text-sm text-mauve-dim">{left} left</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Tables & bottle service</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              Reserved tables sell as one unit and admit their whole party. Buyers pick them from a map on the event page.
            </p>
            <TableManager eventId={event.id} tables={tableTiers} />
          </Card>

          {waitlist > 0 && (
            <Card className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-cream">Waitlist</p>
                  <p className="mt-0.5 text-sm text-mauve-dim">
                    {waitlist} {waitlist === 1 ? "person is" : "people are"} waiting. Text them a buy link when seats open.
                  </p>
                </div>
                {smsOff ? (
                  <p className="max-w-xs text-sm text-mauve-dim">
                    <span className="font-medium text-cream">Texting isn’t switched on yet</span> — the waitlist is
                    notified by text; this button wakes up when carrier approval lands.
                  </p>
                ) : (
                  <form action={notifyWaitlistAction}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <button className={buttonClass("secondary")}>Notify waitlist</button>
                  </form>
                )}
              </div>
            </Card>
          )}
        </TabPanel>

        {/* ── Promotion ──────────────────────────────────────────────────── */}
        <TabPanel id="promotion">
          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Promo codes</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              Discounts buyers enter at checkout — percentage or flat amount, with an optional cap on uses.
            </p>
            <PromoCodes eventId={event.id} codes={promoCodes} />
          </Card>

          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Promoter links</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              Give each promoter their own link. Sales through it are tracked to them — set a commission per order
              to see what you owe.
            </p>
            <PromoterLinks eventId={event.id} slug={event.slug} links={promoterLinks} />
          </Card>

          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Message your buyers</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              A quick update to everyone who bought and opted in — reminders, set times, last-minute changes.
              Goes out by email now{smsOff ? "; texts join once carrier approval lands" : " and by text"}.
            </p>
            <BroadcastForm eventId={event.id} audience={audience} smsOff={smsOff} history={broadcastHistory} />
          </Card>
        </TabPanel>

        {/* ── Guests: the door ───────────────────────────────────────────── */}
        <TabPanel id="guests">
          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Run the door</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              {event.tickets_sold > 0
                ? `${event.tickets_sold} ${event.tickets_sold === 1 ? "ticket" : "tickets"} sold · ${event.checked_in} checked in.`
                : "No tickets yet — the guest list fills as people buy."}
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href={`/o/events/${event.id}/guests`} variant="primary">
                Guest list
              </LinkButton>
              <LinkButton href={`/scan/${event.id}`} variant="secondary">
                Open door scanner
              </LinkButton>
              <LinkButton href={`/scan/${event.id}/sell`} variant="secondary">
                Box office
              </LinkButton>
            </div>
          </Card>

          <Card className="mb-6">
            <p className="font-display font-semibold text-cream">Issue comps</p>
            <p className="mb-4 mt-0.5 text-sm text-mauve-dim">
              Free passes for guest list, press, or artist plus-ones. They scan at the door like any ticket — no
              charge, but they count toward capacity.
            </p>
            {smsOff && (
              <p className="mb-4 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm text-mauve-dim">
                <span className="font-medium text-cream">Texting isn’t switched on yet</span> — the pass is emailed
                if you enter an email. You can also send the link yourself from the guest list.
              </p>
            )}
            <CompForm eventId={event.id} tiers={tiers.map((t) => ({ id: t.id, name: t.name }))} />
          </Card>
        </TabPanel>
      </SectionTabs>
    </div>
  );
}
