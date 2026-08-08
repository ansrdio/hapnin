/**
 * The §3 ledger. A considered typographic block, not a card — three small
 * reckonings stacked, each with a rule under it, ending on the zero. Built to
 * be the thing someone screenshots.
 */
export function Arithmetic() {
  return (
    <figure className="my-14">
      <div className="mx-auto max-w-md font-display tabular-nums">
        <Row top="300 tickets  ×  $40" bottom="$12,000" bottomLabel="raised" tone="cream" />
        <Row
          top="platform fee, this tier"
          topSub="≈ 10%  +  ~$1 / ticket"
          bottom="~$1,500"
          bottomLabel="taken"
          tone="coral"
        />
        <Row
          top="tickets that platform’s feed"
          topSub="brought to the door in Phoenix"
          bottom="0"
          bottomLabel="delivered"
          tone="gold"
          last
        />
      </div>
      <figcaption className="mx-auto mt-8 max-w-md text-[1.075rem] leading-[1.7] text-mauve-dim">
        Roughly <strong className="font-medium text-cream">$1,500</strong> — about a month of a small
        venue’s rent — for what was, in this market, a payment processor. In a dense city the feed
        would have earned it. Here it brought no one.
      </figcaption>
    </figure>
  );
}

function Row({
  top,
  topSub,
  bottom,
  bottomLabel,
  tone,
  last,
}: {
  top: string;
  topSub?: string;
  bottom: string;
  bottomLabel: string;
  tone: "cream" | "coral" | "gold";
  last?: boolean;
}) {
  const toneClass =
    tone === "coral" ? "text-coral" : tone === "gold" ? "text-gold" : "text-cream";
  return (
    <div className={last ? "" : "mb-8"}>
      <div className="text-sm font-medium uppercase tracking-[0.12em] text-mauve-dim/90">{top}</div>
      {topSub && <div className="mt-0.5 text-sm text-mauve-dim/70">{topSub}</div>}
      <div className="mt-2 border-t border-plum-hi pt-2">
        <span className={`text-4xl font-bold ${toneClass}`}>{bottom}</span>
        <span className="ml-3 text-sm uppercase tracking-[0.14em] text-mauve-dim">{bottomLabel}</span>
      </div>
    </div>
  );
}
