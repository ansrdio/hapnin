import { SOURCES } from "../sources";

const BUILD_DATE = "August 2026";

/** Dated references block + build-date line at the foot of the essay. */
export function References() {
  return (
    <section aria-labelledby="references-heading" className="mt-20 border-t border-plum-hi pt-10">
      <h2 id="references-heading" className="font-display text-lg font-semibold text-cream">
        References
      </h2>
      <p className="mt-2 text-sm text-mauve-dim/80">
        Figures current as of {BUILD_DATE}. Fees and demographics change; each is dated so it can be
        checked.
      </p>
      <ol className="mt-6 space-y-4">
        {SOURCES.map((s, i) => (
          <li key={s.key} id={`note-${i + 1}`} className="scroll-mt-24 text-sm leading-relaxed text-mauve-dim">
            <span className="mr-2 font-display font-semibold text-gold">{i + 1}.</span>
            <cite className="not-italic">{s.label}</cite>{" "}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream/80 underline decoration-plum-hi underline-offset-2 hover:decoration-gold"
            >
              {new URL(s.url).hostname.replace(/^www\./, "")}
            </a>
            <span className="ml-2 text-mauve-dim/70">· {s.dated}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
