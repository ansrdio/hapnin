import Link from "next/link";
import type { Metadata } from "next";
import { HostSignupForm } from "./HostSignupForm";
import { FeeCalculator } from "@/app/pitch/components/FeeCalculator";

export const metadata: Metadata = {
  title: "Host on Hapnin — 3% + 50¢ a ticket, free events free",
  description:
    "Ticketing for African events in Phoenix. Apple Pay checkout, payouts straight to your own Stripe account, door scanning that works offline. 3% + 50¢ per paid ticket; free events cost nothing.",
};

const PERKS: [string, string][] = [
  ["Your own payouts", "Every sale settles into your Stripe account, not ours. Stripe pays you out on its normal schedule."],
  ["Checkout in ten seconds", "Apple Pay, Google Pay, Link and cards. Buyers cover card processing, so you keep the face value."],
  ["Built for the night", "Tiers, tables & bottle service, promo codes, promoter links, comps, group tickets, bring-a-friend."],
  ["A door that works", "Scan from any phone — even with no signal. A live board for the wall. Box office for walk-ups."],
  ["Reach your people", "Import your list, follow buttons on your page, announcements, reminders and thank-yous sent for you."],
  ["Free events, free", "RSVP nights, screenings, meetups: $0 tickets carry no fee and need no payout setup."],
];

const STEPS: [string, string][] = [
  ["Create", "Pick a template — afrobeats night, day party, screening, owambe — and change what you like. Three minutes."],
  ["Share", "One link and a QR poster. Buyers get a ticket on their phone, and a share link that gets their friends a discount."],
  ["Run the door", "Scan QR codes at the entrance. Watch the count climb on the live board. Sell walk-ups from the same phone."],
  ["Get paid", "Money is already in your Stripe account. The morning after, Hapnin thanks your guests and asks them to rate the night."],
];

const FAQ: [string, string][] = [
  ["What does it cost?", "3% + 50¢ per paid ticket, taken out of each sale before payout. Nothing monthly, nothing to set up. Free tickets carry no fee at all. Buyers pay card processing (2.9% + 30¢) on top of the ticket price, so the face value is yours."],
  ["When do I get paid?", "Sales settle into your own Stripe Express account as they happen. Stripe pays out to your bank on its standard schedule (typically 2 business days after your first payout clears). Your Earnings page shows the exact next payout."],
  ["Do I need Stripe to start?", "Only for paid tickets. Free RSVP events publish and run without it. Connecting takes about two minutes on your phone — ID, bank details, done."],
  ["What about refunds?", "You choose the policy per event: all sales final, refundable up to 7 days before, or anytime before. Refund with one tap from the guest list; the buyer is emailed and the ticket is voided at the door."],
  ["Can my team scan?", "Yes. Add door staff with their own login — scanner and guest list only, no access to money or settings. The scanner keeps working when the venue's signal drops and syncs when it's back."],
  ["Do you text my buyers?", "Only buyers who opt in at checkout, and only about your events and Hapnin. Reminders the day before and the day of go out automatically. Texts follow US carrier rules; email always works."],
];

// `?src=launch-night` tags the sign-up's source; `?code=…` prefills a launch code.
export default async function HostPage({ searchParams }: { searchParams: Promise<{ src?: string; code?: string }> }) {
  const { src, code } = await searchParams;
  const cleanSrc = src && /^[a-z0-9_-]{1,40}$/i.test(src) ? src.toLowerCase() : null;
  const cleanCode = code && /^[a-z0-9_-]{1,24}$/i.test(code) ? code.toUpperCase() : null;
  return (
    <main className="grain min-h-[100svh]">
      {/* Hero + form */}
      <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_minmax(0,440px)] lg:py-20">
        <div className="anim-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Host on Hapnin</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">
            Throw the night. Keep the money.
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-mauve-dim">
            Ticketing built for afrobeats nights, amapiano day parties, Nollywood screenings, owambe and everything the
            diaspora throws in Phoenix. Paid straight to your own account.
          </p>
          <p className="mt-6 inline-flex flex-wrap items-baseline gap-x-2 rounded-2xl border border-gold/40 bg-gold/[0.07] px-5 py-3">
            <span className="font-display text-3xl font-bold text-cream">3% + 50¢</span>
            <span className="text-sm text-mauve-dim">per paid ticket · free events free · no monthly fee</span>
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
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

        <div id="signup" className="anim-rise d-1 self-start rounded-3xl border border-white/10 bg-plum/40 p-6 backdrop-blur sm:p-8 lg:sticky lg:top-6">
          <h2 className="mb-6 font-display text-2xl font-bold text-cream">Create your host account</h2>
          <HostSignupForm src={cleanSrc} code={cleanCode} />
          <p className="mt-5 text-center text-sm text-mauve-dim">
            Already host? <Link href="/login?next=/o" className="text-gold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* How the night works */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-cream">From flyer to payout.</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="font-display text-sm font-bold text-gold">0{i + 1}</span>
                <p className="mt-2 font-display text-lg font-semibold text-cream">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-mauve-dim">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">What it costs</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-cream">See what you keep.</h2>
          <p className="mt-2 max-w-2xl text-mauve-dim">
            Hapnin takes 3% + 50¢ on each paid ticket. Marketplace platforms typically take 7–10% plus $1–2 a ticket
            for the same night — set the right-hand side to whatever you pay now.
          </p>
          <div className="mt-8">
            <FeeCalculator />
          </div>
          <div className="mt-8 grid gap-4 text-sm text-mauve-dim sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="font-display font-semibold text-cream">Buyers cover card processing</p>
              <p className="mt-1">2.9% + 30¢ is added at checkout, the same as everywhere. It never comes out of your face value.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="font-display font-semibold text-cream">Free events are free</p>
              <p className="mt-1">$0 tickets: no Hapnin fee, no card fee, no payout setup. Real tickets with QR codes all the same.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="font-display font-semibold text-cream">No contracts, no minimums</p>
              <p className="mt-1">Run one event or fifty. Nothing to cancel, nothing charged when you&rsquo;re not selling.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Questions</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-cream">The ones every organizer asks.</h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <dt className="font-display font-semibold text-cream">{q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-mauve-dim">{a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href="#signup" className="rounded-full bg-gold px-8 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi">
              Create your host account
            </a>
            <p className="text-sm text-mauve-dim">
              Fees in full on our <Link href="/terms" className="text-gold hover:underline">terms</Link>. Questions: jii@hapnin.now
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
