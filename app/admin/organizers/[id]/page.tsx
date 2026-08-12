import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerById } from "@/lib/organizers";
import { startOnboardingAction } from "../../actions";
import { TestSmsForm } from "./TestSmsForm";

export const dynamic = "force-dynamic";

export default async function OrganizerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { id } = await params;
  const { onboarding } = await searchParams;
  const o = await getOrganizerById(id);
  if (!o) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-mauve-dim hover:text-cream">← Organizers</Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-cream">{o.name}</h1>
        <p className="text-mauve-dim">/o/{o.handle} · {o.email} · {o.phone}</p>
      </div>

      {onboarding === "done" && (
        <p className="rounded-xl border border-emerald/40 bg-emerald/10 p-4 text-sm text-cream">
          Returned from Stripe. Status updates here once Stripe confirms via webhook — refresh in a moment.
        </p>
      )}

      <section className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
        <h2 className="font-display text-lg font-semibold text-cream">Stripe Connect</h2>
        <p className="mt-1 text-sm text-mauve-dim">
          Status:{" "}
          <span className={o.stripe_onboarded ? "text-emerald" : "text-gold"}>
            {o.stripe_onboarded ? "Onboarded — can receive payouts" : "Not onboarded yet"}
          </span>
          {o.stripe_account_id && <span className="ml-2 text-mauve-dim/70">({o.stripe_account_id})</span>}
        </p>
        <form action={startOnboardingAction} className="mt-4">
          <input type="hidden" name="organizer_id" value={o.id} />
          <button className="rounded-xl bg-gold px-5 py-3 font-display font-semibold text-ink transition-colors hover:bg-gold-hi">
            {o.stripe_account_id ? "Continue Stripe onboarding" : "Start Stripe onboarding"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
        <h2 className="font-display text-lg font-semibold text-cream">Test SMS</h2>
        <p className="mt-1 text-sm text-mauve-dim">Sends to {o.phone}. Logs to the server console until Twilio creds are set.</p>
        <TestSmsForm organizerId={o.id} />
      </section>
    </div>
  );
}
