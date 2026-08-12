import Link from "next/link";
import { listOrganizers } from "@/lib/organizers";
import { CreateOrganizerForm } from "./CreateOrganizerForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const organizers = await listOrganizers();

  return (
    <div className="space-y-10">
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
                  <p className="text-sm text-mauve-dim">/o/{o.handle} · {o.email}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    o.stripe_onboarded ? "bg-emerald/15 text-emerald" : "bg-plum text-mauve-dim"
                  }`}
                >
                  {o.stripe_onboarded ? "Onboarded" : "Onboarding pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateOrganizerForm />
    </div>
  );
}
