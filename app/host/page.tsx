import Link from "next/link";
import type { Metadata } from "next";
import { HostSignupForm } from "./HostSignupForm";

export const metadata: Metadata = {
  title: "Host on Hapnin",
  description: "Sell tickets to your African events on Hapnin. Free to start, payouts to your own account.",
};

const PERKS = [
  ["Your own payouts", "Money from every sale lands in your Stripe account — never ours."],
  ["Built for the culture", "Tiers, tables & bottle service, comps, promoter links, and door scanning."],
  ["Reach your people", "A public page, share links, and texts to buyers who opt in."],
];

export default function HostPage() {
  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_minmax(0,440px)] lg:py-20">
        {/* Pitch */}
        <div className="anim-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Host on Hapnin</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">
            Throw the night. Keep the money.
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-mauve-dim">
            Sell tickets to your afrobeats night, amapiano set, Nollywood screening, or culture festival —
            and get paid straight to your own account.
          </p>
          <ul className="mt-8 space-y-5">
            {PERKS.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-coral" aria-hidden="true" />
                <div>
                  <p className="font-display font-semibold text-cream">{t}</p>
                  <p className="text-sm text-mauve-dim">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="anim-rise d-1 rounded-3xl border border-white/10 bg-plum/40 p-6 backdrop-blur sm:p-8">
          <h2 className="mb-6 font-display text-2xl font-bold text-cream">Create your host account</h2>
          <HostSignupForm />
          <p className="mt-5 text-center text-sm text-mauve-dim">
            Already host? <Link href="/login?next=/o" className="text-gold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
