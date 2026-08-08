/**
 * The same room, carried across three events. Static and calm — makes
 * "you keep the room" concrete without competing with the calculator.
 * Shared by the slideshow and the read-as-a-page fallback.
 */
export function CrowdGrowth() {
  const steps = [
    { label: "First event", count: 200, fill: 0.5, color: "bg-gold" },
    { label: "Next event", count: 280, fill: 0.7, color: "bg-coral", note: "200 + returners" },
    { label: "The one after", count: 360, fill: 0.9, color: "bg-emerald", note: "and it grows" },
  ];
  return (
    <div className="rounded-2xl border border-plum-hi bg-plum/40 p-6">
      <p className="text-sm uppercase tracking-[0.14em] text-mauve-dim">The room you keep</p>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {steps.map((s) => (
          <div key={s.label} className="flex flex-col">
            <div className="flex h-24 items-end sm:h-28">
              <div
                className={`w-full rounded-t-md ${s.color}`}
                style={{ height: `${s.fill * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 font-display text-xl font-bold tabular-nums text-cream">
              {s.count}
            </div>
            <div className="text-xs text-mauve-dim">{s.label}</div>
            {s.note && <div className="mt-0.5 text-[11px] text-mauve-dim/70">{s.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
