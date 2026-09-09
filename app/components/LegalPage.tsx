import Link from "next/link";
import type { ReactNode } from "react";
import { LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

// Shell for /terms and /privacy — mirrors the /why prose layout so the legal
// pages read as part of the site, not a bolt-on. Headings/paragraphs inside
// `children` are styled via arbitrary-variant selectors so the pages can be
// plain semantic HTML.
export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="px-5 sm:px-8">
      <article className="mx-auto max-w-[42rem] pb-8 pt-16 sm:pt-24">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-mauve-dim">{intro}</p>
          <p className="mt-3 text-sm text-mauve-dim/80">Last updated {LAST_UPDATED}.</p>
        </header>

        <div
          className="mt-10 text-[1.05rem] leading-relaxed text-mauve-dim
            [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-cream
            [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6
            [&_strong]:font-semibold [&_strong]:text-cream
            [&_a]:text-cream [&_a]:underline [&_a]:decoration-gold/50 [&_a]:underline-offset-4 hover:[&_a]:decoration-gold"
        >
          {children}
        </div>

        <footer className="mt-16 border-t border-plum-hi pt-10 text-sm text-mauve-dim">
          <p>
            Questions about this page:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cream underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-3">
            <Link href="/terms" className="hover:text-cream">Terms</Link> · <Link href="/privacy" className="hover:text-cream">Privacy</Link> ·{" "}
            <Link href="/" className="hover:text-cream">hapnin.now</Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
