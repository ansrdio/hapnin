import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizerById } from "@/lib/organizers";
import { listEventsByOrganizer } from "@/lib/events";
import { startOnboardingAction, refreshStripeStatusAction } from "../../actions";
import { TestSmsForm } from "./TestSmsForm";
import { CreateEventForm } from "./CreateEventForm";

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
  const events = await listEventsByOrganizer(id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-mauve-dim hover:text-cream">← Organizers</Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-cream">{o.name}</h1>
        <p className="text-mauve-dim">/o/{o.handle} · {o.email} · {o.phone}</p>
      </div>

      {onboarding === "done" && (
        <p className="rounded-xl border border-emerald/40 bg-emerald/10 p-4 text-sm text-cream">
          Back from Stripe — click <span className="font-semibold">Refresh status</span> below to pull
          the latest onboarding state.
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
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={startOnboardingAction}>
            <input type="hidden" name="organizer_id" value={o.id} />
            <button className="rounded-xl bg-gold px-5 py-3 font-display font-semibold text-ink transition-colors hover:bg-gold-hi">
              {o.stripe_account_id ? "Continue Stripe onboarding" : "Start Stripe onboarding"}
            </button>
          </form>
          {o.stripe_account_id && (
            <form action={refreshStripeStatusAction}>
              <input type="hidden" name="organizer_id" value={o.id} />
              <button className="rounded-xl border border-plum-hi px-5 py-3 font-display text-cream transition-colors hover:bg-plum">
                Refresh status
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
        <h2 className="font-display text-lg font-semibold text-cream">Test SMS</h2>
        <p className="mt-1 text-sm text-mauve-dim">Sends to {o.phone}. Logs to the server console until Twilio creds are set.</p>
        <TestSmsForm organizerId={o.id} />
      </section>

      <section className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
        <h2 className="font-display text-lg font-semibold text-cream">Events</h2>
        {events.length > 0 && (
          <ul className="mt-3 divide-y divide-plum-hi rounded-xl border border-plum-hi">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-display font-semibold text-cream">{e.title}</p>
                  <p className="text-sm text-mauve-dim">/e/{e.slug} · {e.status}</p>
                </div>
                <a href={`/e/${e.slug}`} target="_blank" rel="noreferrer" className="text-sm text-gold hover:underline">
                  View →
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 border-t border-plum-hi pt-6">
          <h3 className="mb-4 font-display font-semibold text-cream">Create event</h3>
          <CreateEventForm organizerId={o.id} />
        </div>
      </section>
    </div>
  );
}
