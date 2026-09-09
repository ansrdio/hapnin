"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Tabs for the event manage page. Every section still renders server-side with
// its forms and server actions intact; the tabs only control visibility, so no
// data flow changes. The active tab lives in the URL hash (#tickets) so links
// can deep-link and a reload keeps your place.

type Tab = { id: string; label: string; count?: number };
const Ctx = createContext<string>("");

export function SectionTabs({ tabs, defaultTab, children }: { tabs: Tab[]; defaultTab?: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0].id);

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h && tabs.some((t) => t.id === h)) setActive(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <Ctx.Provider value={active}>
      <nav role="tablist" aria-label="Event sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-plum-hi">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => select(t.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 font-display text-sm font-semibold transition-colors ${
                on ? "border-gold text-cream" : "border-transparent text-mauve-dim hover:text-cream"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${on ? "bg-gold/20 text-gold" : "bg-plum text-mauve-dim"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {children}
    </Ctx.Provider>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const active = useContext(Ctx);
  return (
    <div role="tabpanel" hidden={active !== id}>
      {children}
    </div>
  );
}
