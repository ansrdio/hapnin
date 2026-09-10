import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getEventEarnings } from "@/lib/earnings";
import { openStripeDashboardAction } from "@/app/o/actions";
import { getPayoutSnapshot } from "@/lib/connect";
import { PageHeader, Card, Stat, LinkButton, buttonClass, money } from "@/app/components/ui";

export const dynamic = "force-dynamic";

// "What do I actually get?" — the page an organizer opens after a good night,
// and the one that answers the question in every first meeting.
export default async function EarningsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer, role } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const e = await getEventEarnings(id);
  const online = e.online;
  const hasDoor = e.door.tickets > 0;
  // "When do I get paid?" — live from Stripe, owner only, never fatal.
  const payout =
    role === "owner" && organizer.stripe_onboarded ? await getPayoutSnapshot(organizer.id).catch(() => null) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Earnings"
        subtitle={event.title}
        back={{ href: `/o/events/${id}`, label: event.title }}
        action={
          role === "owner" && organizer.stripe_onboarded ? (
            <form action={openStripeDashboardAction}>
              <button className={buttonClass("secondary")}>Open Stripe payouts ↗</button>
            </form>
          ) : (
            <LinkButton href={`/o/events/${id}/analytics`} variant="secondary">
              Analytics
            </LinkButton>
          )
        }
      />

      {/* The number */}
      <Card className="mb-6 border-gold/30 bg-gold/[0.04]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Net to you</p>
        <p className="mt-2 font-display text-5xl font-bold tabular-nums text-cream">{money(e.total_net_cents)}</p>
        <p className="mt-2 text-sm text-mauve-dim">
          {online.tickets + e.door.tickets} paid {online.tickets + e.door.tickets === 1 ? "ticket" : "tickets"}
          {e.comps > 0 && <> · {e.comps} comp{e.comps === 1 ? "" : "s"} (free)</>}
          {e.refunded.orders > 0 && <> · {e.refunded.orders} refunded</>}
        </p>
      </Card>

      {payout && (
        <Card className="mb-6">
          <p className="mb-4 font-display font-semibold text-cream">Your Stripe payouts</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Available now" value={money(payout.available_cents)} sub="ready to pay out" />
            <Stat label="On the way" value={money(payout.pending_cents)} sub="still clearing" />
            <Stat
              label="Last payout"
              value={payout.last_payout ? money(payout.last_payout.amount_cents) : "—"}
              sub={
                payout.last_payout
                  ? `${payout.last_payout.status} · ${new Date(payout.last_payout.arrival_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "none yet"
              }
            />
          </div>
          <p className="mt-3 text-xs text-mauve-dim">
            Schedule: {payout.schedule}. These are your whole Stripe balance across all events, live from Stripe.
          </p>
        </Card>
      )}

      {/* How the online number is built */}
      <Card className="mb-6">
        <p className="mb-4 font-display font-semibold text-cream">Online sales (paid out by Stripe)</p>
        <dl className="space-y-2 text-sm">
          <Row label={`Ticket sales · ${online.tickets} ${online.tickets === 1 ? "ticket" : "tickets"}`} value={money(online.face_cents + online.discount_cents)} />
          {online.discount_cents > 0 && <Row label="Promo discounts" value={`−${money(online.discount_cents)}`} muted />}
          <Row label="Face value collected" value={money(online.face_cents)} />
          <Row label="Hapnin fee" value={`−${money(online.hapnin_fee_cents)}`} muted hint={online.hapnin_fee_cents === 0 && online.tickets > 0 ? "waived — first event" : undefined} />
          <div className="flex items-baseline justify-between border-t border-plum-hi pt-2 font-semibold text-cream">
            <dt>Net to you</dt>
            <dd className="tabular-nums">{money(online.net_cents)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-mauve-dim">
          Buyers also paid <span className="text-cream">{money(online.card_fee_cents)}</span> in card processing on top of
          face value — that covers Stripe&rsquo;s fee, so it&rsquo;s neither your income nor your cost. Stripe pays your
          net into your own account on its payout schedule.
        </p>
      </Card>

      {hasDoor && (
        <Card className="mb-6">
          <p className="mb-4 font-display font-semibold text-cream">Door sales (collected by you)</p>
          <dl className="space-y-2 text-sm">
            <Row label={`Box office · ${e.door.tickets} ${e.door.tickets === 1 ? "ticket" : "tickets"}`} value={money(e.door.face_cents)} />
          </dl>
          <p className="mt-3 text-xs text-mauve-dim">Cash or card taken at the door — already in your hands, no Hapnin fee.</p>
        </Card>
      )}

      {/* By tier */}
      <Card className="mb-6">
        <p className="mb-4 font-display font-semibold text-cream">By tier</p>
        <div className="divide-y divide-plum-hi">
          {e.tiers.map((t) => (
            <div key={t.tierId} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 text-sm">
              <span className="text-cream">{t.name}</span>
              <span className="text-mauve-dim">
                {t.tickets} sold · <span className="tabular-nums text-cream">{money(t.face_cents)}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {e.refunded.orders > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Refunded orders" value={e.refunded.orders} />
          <Stat label="Refunded amount" value={money(e.refunded.amount_cents)} sub="returned to buyers' cards" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted, hint }: { label: string; value: string; muted?: boolean; hint?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${muted ? "text-mauve-dim" : "text-cream"}`}>
      <dt>
        {label}
        {hint && <span className="ml-2 text-xs text-emerald">{hint}</span>}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
