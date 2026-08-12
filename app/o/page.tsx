import { requireOrganizer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrganizerHome() {
  const { organizer } = await requireOrganizer();
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-semibold text-cream">You’re signed in.</h1>
      <p className="mt-2 leading-relaxed text-mauve-dim">
        {organizer.name} — your login and account are set up. Your dashboard (events, sales, guest
        list, broadcasts) arrives in Phase 2.
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between border-b border-plum-hi py-2">
          <dt className="text-mauve-dim">Public page</dt>
          <dd className="text-cream">/o/{organizer.handle}</dd>
        </div>
        <div className="flex justify-between border-b border-plum-hi py-2">
          <dt className="text-mauve-dim">Payouts</dt>
          <dd className={organizer.stripe_onboarded ? "text-emerald" : "text-gold"}>
            {organizer.stripe_onboarded ? "Stripe connected" : "Stripe onboarding pending"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
