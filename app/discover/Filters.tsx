"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { EVENT_TYPE } from "@/lib/enums";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const selectCls =
  "rounded-full border border-white/15 bg-plum/60 px-4 py-2 text-sm text-cream [color-scheme:dark] outline-none transition-colors focus:border-gold";

export function Filters({ cities, city, type }: { cities: string[]; city: string; type: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value === "all") p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    router.push(qs ? `/discover?${qs}` : "/discover");
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select className={selectCls} value={type} onChange={(e) => update("type", e.target.value)} aria-label="Type">
        <option value="all">All types</option>
        {EVENT_TYPE.map((t) => (
          <option key={t} value={t}>
            {cap(t)}
          </option>
        ))}
      </select>
      <span className="text-sm text-mauve-dim">in</span>
      <select className={selectCls} value={city} onChange={(e) => update("city", e.target.value)} aria-label="City">
        <option value="all">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
