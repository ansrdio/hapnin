import Link from "next/link";
import { listOrganizers, isFeeWaived } from "@/lib/organizers";
import { getFounderMetrics } from "@/lib/metrics";
import { Stat, money } from "@/app/components/ui";
import { CreateOrganizerForm } from "./CreateOrganizerForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [organizers, m] = await Promise.all([listOrganizers(), getFounderMetrics().catch(() => null)]);

  return (
    <div className="space-y-10">
      {m && (
        <section>
          <h1 className="font-display text-2xl font-semibold text-cream">Business</h1>
          <p className="mt-1 text-mauve-dim">Paid tickets only — comps and transfers excluded. GMV is face value; fees are Hapnin’s cut.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="GMV · 30 days" value={money(m.last30.gmv_cents)} sub={`${m.last30.tickets} tickets · ${m.last30.orders} orders`} />
            <Stat label="Hapnin fees · 30 days" value={money(m.last30.fees_cents)} sub={m.last30.gmv_cents ? `${((m.last30.fees_cents / m.last30.gmv_cents) * 100).toFixed(1)}% take` : "—"} />
            <Stat label="GMV · all time" value={money(m.all.gmv_cents)} sub={`${m.all.tickets} tickets · ${m.all.orders} orders`} />
            <Stat label="Hapnin fees · all time" value={money(m.all.fees_cents)} sub={m.all.gmv_cents ? `${((m.all.fees_cents / m.all.gmv_cents) * 100).toFixed(1)}% take` : "—"} />
            <Stat label="Organizers" value={m.organizers.total} sub={`${m.organizers.onboarded} taking payments`} />
            <Stat label="Events" value={m.events.total} sub={`${m.events.upcoming} upcoming on sale`} />
            <Stat label="Buyers" value={m.buyers} sub="distinct people" />
            <Stat label="Refunds" value={m.refunds.count} sub={money(m.refunds.amount_cents)} />
          </div>
        </section>
      )}

      <section>
        <h1 className="font-display text-2xl font-semibold text-cream">Organizers</h1>
        <p className="mt-1 text-mauve-dim">Create an organizer, then walk them through Stripe onboarding.</p>

        {organizers.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">
            No organizers yet. Create the first one below.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-plum-hi rounded-2xl border border-plum-hi">
            {organizers.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <Link href={`/admin/organizers/${o.id}`} className="font-display text-lg font-semibold text-cream hover:text-gold">
                    {o.name}
                  </Link>
                  <p className="text-sm text-mauve-dim">
                    /o/{o.handle} · {o.email}
                    {o.signup_source && <span className="ml-2 text-mauve-dim/70">via {o.signup_source}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isFeeWaived(o) && (
                    <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">Fee waived</span>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      o.stripe_onboarded ? "bg-emerald/15 text-emerald" : "bg-plum text-mauve-dim"
                    }`}
                  >
                    {o.stripe_onboarded ? "Onboarded" : "Onboarding pending"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateOrganizerForm />
    </div>
  );
}
