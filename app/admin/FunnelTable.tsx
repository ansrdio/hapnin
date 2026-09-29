import type { Funnel } from "@/lib/discovery";
import { Card, money } from "@/app/components/ui";

// The pilot's numbers for one place or story. Counts are VISITS (one tab's
// journey), not people. Deliberately a table, not a dashboard.

export function FunnelTable({ funnel, kind }: { funnel: Funnel; kind: "place" | "story" }) {
  const p = funnel.purchases;
  return (
    <Card className="space-y-5">
      <div>
        <p className="font-display font-semibold text-cream">Discovery — Experiment 001</p>
        <p className="text-sm text-mauve-dim">Counts are visits (one browser tab&rsquo;s journey, 30-minute idle cutoff), not people. Demo orders are excluded.</p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-plum-hi">
          <tr><th scope="row" className="py-2 text-left font-normal text-mauve-dim">{kind === "story" ? "Viewed the story" : "Viewed the place"}</th><td className="py-2 text-right font-semibold tabular-nums text-cream">{funnel.views.visits} <span className="font-normal text-mauve-dim">({funnel.views.total} views)</span></td></tr>
          {funnel.steps.map((s) => (
            <tr key={s.label}><th scope="row" className="py-2 text-left font-normal text-mauve-dim">{s.label}</th><td className="py-2 text-right font-semibold tabular-nums text-cream">{s.visits}</td></tr>
          ))}
          <tr><th scope="row" className="py-2 text-left font-normal text-mauve-dim">Attributed orders · tickets</th><td className="py-2 text-right font-semibold tabular-nums text-cream">{p.orders} · {p.tickets}</td></tr>
          <tr><th scope="row" className="py-2 text-left font-normal text-mauve-dim">Attributed ticket sales (face value) · Hapnin fees</th><td className="py-2 text-right font-semibold tabular-nums text-cream">{money(p.gmv_cents)} · {money(p.fee_cents)}</td></tr>
          {p.refunded_orders > 0 && <tr><th scope="row" className="py-2 text-left font-normal text-mauve-dim">Attributed orders later refunded</th><td className="py-2 text-right tabular-nums text-cream">{p.refunded_orders}</td></tr>}
        </tbody>
      </table>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Where viewers came from</p>
          {funnel.sources.length === 0 ? <p className="text-sm text-mauve-dim">No views yet.</p> : (
            <ul className="text-sm">{funnel.sources.map((s) => <li key={s.source} className="flex justify-between py-0.5"><span className="text-mauve-dim">{s.source}</span><span className="tabular-nums text-cream">{s.visits}</span></li>)}</ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Campaign / QR tags</p>
          {funnel.campaigns.length === 0 ? <p className="text-sm text-mauve-dim">None yet. Add ?src=… or utm_campaign to links.</p> : (
            <ul className="text-sm">{funnel.campaigns.map((c) => <li key={c.campaign} className="flex justify-between py-0.5"><span className="text-mauve-dim">{c.campaign}</span><span className="tabular-nums text-cream">{c.visits}</span></li>)}</ul>
          )}
        </div>
      </div>
      <p className="text-xs text-mauve-dim">Attributed = the order&rsquo;s checkout visit had seen this {kind}. Face value and fees come from the order records.</p>
    </Card>
  );
}
