import Link from "next/link";
import { ReadingProgress } from "./components/ReadingProgress";
import { References } from "./components/References";

const CONTACT_EMAIL = "jii@hapnin.now";

export default function WhyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ReadingProgress />
      <main className="px-5 sm:px-8">
        <article className="mx-auto max-w-[42rem] pb-8 pt-16 sm:pt-24">
          <header>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-gold">The argument</p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-6xl">
              Why Hapnin exists.
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-mauve-dim">
              Ticketing is a solved problem. This is about the one audience the solution was never
              shaped to fit.
            </p>
          </header>

          {children}

          <References />

          {/* Quiet foot CTA — the only conversion prompt on the page. */}
          <footer className="mt-16 border-t border-plum-hi pt-10">
            <p className="text-[1.075rem] leading-relaxed text-mauve-dim">
              Run African events?{" "}
              <Link
                href="/pitch"
                className="text-cream underline decoration-gold/50 underline-offset-4 hover:decoration-gold"
              >
                Here&rsquo;s the offer.
              </Link>
            </p>
            <p className="mt-2 text-[1.075rem] leading-relaxed text-mauve-dim">
              Everyone else — investors, partners, film-side —{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-cream underline decoration-gold/50 underline-offset-4 hover:decoration-gold"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p className="mt-8 font-display text-sm font-semibold text-cream">
              Hapnin <span className="text-mauve-dim">— hapnin.now · Phoenix, Arizona</span>
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}
