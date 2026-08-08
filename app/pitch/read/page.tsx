import type { Metadata } from "next";
import Link from "next/link";
import { FeeCalculator } from "../components/FeeCalculator";
import { PitchForm } from "../components/PitchForm";
import { CrowdGrowth } from "../components/CrowdGrowth";
import { copy, roomSources, expected, unique, trustPoints } from "../content";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

export const metadata: Metadata = {
  title: "Run one event with Hapnin",
  description: copy.concedeDeck,
  robots: { index: false, follow: false },
  alternates: { canonical: `${siteUrl}/pitch/read` },
};

export default function PitchReadPage() {
  return (
    <main className="px-5 sm:px-8">
      <div className="mx-auto max-w-2xl">
        {/* ===================== HERO / CONCEDE ===================== */}
        <section className="pb-14 pt-14 sm:pb-20 sm:pt-20">
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-gold">
              {copy.heroEyebrow}
            </p>
            <Link
              href="/pitch"
              className="text-sm text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream"
            >
              View as slides
            </Link>
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.04] text-cream sm:text-6xl">
            {copy.concedeTitle}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-mauve-dim sm:text-xl">{copy.concedeDeck}</p>
        </section>

        {/* ===================== WHAT THE FEE IS FOR ===================== */}
        <section className="border-t border-plum-hi py-14 sm:py-20">
          <h2 className="font-display text-2xl font-semibold text-cream sm:text-4xl">
            {copy.feeHeading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mauve-dim">{copy.feeBody}</p>
        </section>

        {/* ===================== THE QUESTION (loud) ===================== */}
        <section className="border-t border-plum-hi py-16 sm:py-24">
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.3em] text-gold">
            One question
          </p>
          <h2 className="font-display text-[2.1rem] font-bold leading-[1.08] text-cream sm:text-5xl">
            {copy.questionHeading}
          </h2>
          <ul className="mt-10 space-y-1.5">
            {roomSources.map((s) => (
              <li key={s} className="font-display text-2xl font-semibold text-cream sm:text-3xl">
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-9 font-display text-2xl font-bold text-gold sm:text-3xl">
            {copy.answerPunch}
          </p>
          <p className="mt-6 max-w-xl leading-relaxed text-mauve-dim">{copy.answerStructural}</p>
        </section>
      </div>

      {/* ===================== CALCULATOR (loud) ===================== */}
      <section className="py-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-plum-hi bg-plum/50 p-6 sm:p-10">
            <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">
              {copy.calcHeading}
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-mauve-dim">{copy.calcSub}</p>
            <div className="mt-8">
              <FeeCalculator />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl">
        {/* ===================== WHAT YOU GET ===================== */}
        <section className="py-14 sm:py-20">
          <h2 className="font-display text-2xl font-semibold text-cream sm:text-4xl">
            {copy.expectHeading}
          </h2>
          <p className="mt-3 text-mauve-dim">{copy.expectSub}</p>
          <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {expected.map(([label, desc]) => (
              <li key={label} className="flex gap-3">
                <span className="mt-2 inline-block h-2 w-2 flex-none rotate-45 bg-gold" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-[1.05rem] font-semibold text-cream">{label}</h3>
                  {desc && <p className="mt-0.5 text-[15px] leading-snug text-mauve-dim">{desc}</p>}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-14 font-display text-2xl font-semibold leading-[1.1] text-cream sm:text-3xl">
            {copy.uniqueHeading}
          </h3>
          <ul className="mt-7 space-y-7">
            {unique.map(([label, desc]) => (
              <li key={label} className="flex gap-4">
                <span className="mt-2.5 inline-block h-2.5 w-2.5 flex-none rotate-45 bg-gold" aria-hidden="true" />
                <div>
                  <h4 className="font-display text-xl font-semibold text-cream">{label}</h4>
                  <p className="mt-1 leading-relaxed text-mauve-dim">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <CrowdGrowth />
          </div>
        </section>
      </div>

      {/* ===================== THE OFFER (loud-ish) ===================== */}
      <section className="py-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-gold/45 bg-gold/[0.07] p-7 sm:p-11">
            <h2 className="font-display text-3xl font-bold leading-[1.03] text-cream sm:text-5xl">
              {copy.offerHeading}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-cream/90">{copy.offerBody}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl">
        {/* ===================== HONESTY ===================== */}
        <section className="py-14 sm:py-20">
          <h2 className="font-display text-2xl font-semibold text-cream sm:text-4xl">
            {copy.honestHeading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mauve-dim">{copy.honestBody}</p>
          <p className="mt-6 text-lg leading-relaxed text-cream">{copy.honestTurn}</p>
        </section>

        {/* ===================== WHAT WE ASK ===================== */}
        <section className="border-t border-plum-hi py-14 sm:py-20">
          <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-emerald">
            <span className="inline-block h-2 w-2 rotate-45 bg-emerald" aria-hidden="true" />
            {copy.trustEyebrow}
          </p>
          <h2 className="font-display text-2xl font-semibold text-cream sm:text-4xl">
            {copy.trustHeading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-cream/90">{copy.trustBody}</p>
          <ul className="mt-7 space-y-4">
            {trustPoints.map((t) => (
              <li key={t} className="flex gap-3 leading-relaxed text-mauve-dim">
                <span className="mt-2.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-xl leading-relaxed text-mauve-dim">{copy.whyWeAsk}</p>
        </section>

        {/* ===================== WHO'S BEHIND THIS ===================== */}
        <section className="border-t border-plum-hi py-14 sm:py-20">
          <h2 className="font-display text-2xl font-semibold text-cream sm:text-4xl">
            {copy.bioHeading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mauve-dim">{copy.bio}</p>
          <p className="mt-5 text-lg leading-relaxed text-cream">{copy.bioClose}</p>
        </section>

        {/* ===================== THE ASK (form) ===================== */}
        <section id="lets-run-one" className="scroll-mt-8 border-t border-plum-hi py-14 sm:py-20">
          <h2 className="font-display text-3xl font-bold text-cream sm:text-5xl">{copy.askHeading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-mauve-dim">{copy.askBody}</p>
          <div className="mt-9">
            <PitchForm />
          </div>
        </section>

        {/* ===================== FOOTER ===================== */}
        <footer className="border-t border-plum-hi py-10">
          <p className="text-[1.05rem] leading-relaxed text-mauve-dim">
            Want the longer argument?{" "}
            <Link
              href="/why"
              className="text-cream underline decoration-gold/50 underline-offset-4 hover:decoration-gold"
            >
              Read the case for Hapnin.
            </Link>
          </p>
          <p className="mt-6 font-display text-lg font-semibold text-cream">
            Hapnin <span className="text-mauve-dim">— hapnin.now · Phoenix, Arizona</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
