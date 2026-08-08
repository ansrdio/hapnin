import { copy } from "../content";
import { LAST_VERIFIED, platforms, rows, type Row } from "../comparison";

// Renders a value: "yes" → tick, "no" → dash, anything else → text.
// `anchor` rows and the Hapnin column read at full weight; everything else is
// supporting detail at a lighter weight. "None" is left as deliberate text.
function Cell({ value, anchor, hapnin }: { value: string; anchor?: boolean; hapnin?: boolean }) {
  if (value === "yes") {
    return (
      <span className="inline-flex" aria-label="yes">
        <Check className={hapnin ? "text-gold" : "text-cream"} />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="text-mauve-dim/50" aria-label="no">
        —
      </span>
    );
  }
  const strong = anchor || hapnin;
  return <span className={strong ? "text-cream" : "text-mauve-dim"}>{value}</span>;
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ComparisonTable() {
  return (
    <section aria-labelledby="compare-heading">
      <h2 id="compare-heading" className="font-display text-3xl font-bold leading-[1.08] text-cream sm:text-4xl">
        {copy.comparisonHeading}
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-mauve-dim">{copy.comparisonIntro}</p>

      {/* Desktop: real table */}
      <div className="mt-9 hidden md:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className="w-[26%] py-3 text-left align-bottom" />
              {platforms.map((name, i) => (
                <th
                  key={name}
                  scope="col"
                  className={`border-b border-plum-hi px-4 py-3 text-left align-bottom font-display text-lg font-semibold ${
                    i === 0 ? "rounded-t-xl bg-gold/[0.06] text-gold" : "text-cream"
                  }`}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th
                  scope="row"
                  className={`border-b border-plum-hi/60 py-3 pr-4 text-left font-normal ${
                    row.anchor ? "text-cream" : "text-mauve-dim"
                  }`}
                >
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={`border-b border-plum-hi/60 px-4 py-3 tabular-nums ${
                      i === 0 ? "bg-gold/[0.05]" : ""
                    } ${row.anchor ? "font-medium" : ""}`}
                  >
                    <Cell value={v} anchor={row.anchor} hapnin={i === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per platform, Hapnin first, no horizontal scroll */}
      <div className="mt-8 space-y-4 md:hidden">
        {platforms.map((name, ci) => (
          <div
            key={name}
            className={`rounded-2xl border p-5 ${
              ci === 0 ? "border-gold/40 bg-gold/[0.06]" : "border-plum-hi bg-plum/40"
            }`}
          >
            <h3 className={`font-display text-lg font-semibold ${ci === 0 ? "text-gold" : "text-cream"}`}>
              {name}
            </h3>
            <dl className="mt-3 divide-y divide-plum-hi/60">
              {rows.map((row: Row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className={`text-sm ${row.anchor ? "text-cream/90" : "text-mauve-dim"}`}>
                    {row.label}
                  </dt>
                  <dd className={`text-right text-sm tabular-nums ${row.anchor ? "font-medium" : ""}`}>
                    <Cell value={row.values[ci]} anchor={row.anchor} hapnin={ci === 0} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-cream">{copy.comparisonUnder}</p>

      <p className="mt-6 text-xs text-mauve-dim/70">
        Published rates as of {LAST_VERIFIED}. Verify current pricing with each platform — fees change.
      </p>
    </section>
  );
}
