"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, SCENE_TAGS, categoryLabel, sceneTagLabel } from "@/lib/taxonomy";

export type Card = {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue_name: string;
  starts_at: number;
  flyer_url: string | null;
  category: string;
  scene_tags: string[];
  from_cents: number | null;
  free: boolean;
  talent: string[];
};

const usd = (c: number) => (c % 100 === 0 ? `$${c / 100}` : `$${(c / 100).toFixed(2)}`);
const TZ = "America/Phoenix";

const phxDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const phxWeekday = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const selectCls =
  "rounded-full border border-white/15 bg-plum/60 px-4 py-2 text-sm text-cream [color-scheme:dark] outline-none transition-colors focus:border-gold";

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-gold bg-gold text-ink" : "border-white/15 bg-plum/60 text-mauve-dim hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

export function DiscoverClient({ cards, cities }: { cards: Card[]; cities: string[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [scene, setScene] = useState("all");
  const [city, setCity] = useState("all");

  // Only offer the choices the current inventory can actually satisfy — a
  // short list of real options beats a long list of empty ones. Order follows
  // the taxonomy, not the data, so the chips read consistently day to day.
  const categories = useMemo(() => {
    const present = new Set(cards.map((c) => c.category));
    return CATEGORIES.filter((c) => present.has(c.id));
  }, [cards]);
  const scenes = useMemo(() => {
    const present = new Set(cards.flatMap((c) => c.scene_tags));
    return SCENE_TAGS.filter((t) => present.has(t.id));
  }, [cards]);
  const [when, setWhen] = useState<"any" | "tonight" | "weekend">("any");
  const [freeOnly, setFreeOnly] = useState(false);

  const results = useMemo(() => {
    const now = Date.now();
    const today = phxDay(now);
    const needle = q.trim().toLowerCase();

    return cards.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (scene !== "all" && !c.scene_tags.includes(scene)) return false;
      if (city !== "all" && c.city !== city) return false;
      if (freeOnly && !c.free) return false;
      if (when === "tonight" && !(phxDay(c.starts_at) === today && c.starts_at >= now)) return false;
      if (when === "weekend") {
        const soon = c.starts_at <= now + 7 * 86_400_000;
        const wd = phxWeekday(c.starts_at);
        if (!(soon && (wd === "Fri" || wd === "Sat" || wd === "Sun"))) return false;
      }
      if (needle) {
        const hay = `${c.title} ${c.venue_name} ${c.city} ${c.talent.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [cards, q, category, scene, city, when, freeOnly]);

  return (
    <div>
      {/* Search */}
      <div className="anim-rise d-1 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events, venues, artists…"
          className="w-full rounded-2xl border border-white/12 bg-plum/50 px-5 py-3.5 text-cream placeholder:text-mauve-dim/60 outline-none transition-colors focus:border-gold"
        />
      </div>

      {/* Quick filters + selects */}
      <div className="anim-rise d-1 mb-8 flex flex-wrap items-center gap-2.5">
        <Pill active={when === "tonight"} onClick={() => setWhen(when === "tonight" ? "any" : "tonight")}>Tonight</Pill>
        <Pill active={when === "weekend"} onClick={() => setWhen(when === "weekend" ? "any" : "weekend")}>This weekend</Pill>
        <Pill active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>Free</Pill>
        <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
        {categories.length > 0 && (
          <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryLabel(c.id)}</option>
            ))}
          </select>
        )}
        {scenes.length > 0 && (
          <select className={selectCls} value={scene} onChange={(e) => setScene(e.target.value)} aria-label="Scene">
            <option value="all">All scenes</option>
            {scenes.map((t) => (
              <option key={t.id} value={t.id}>{sceneTagLabel(t.id)}</option>
            ))}
          </select>
        )}
        {cities.length > 1 && (
          <select className={selectCls} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Grid */}
      {results.length === 0 ? (
        <p className="rounded-2xl border border-plum-hi bg-plum/40 p-8 text-mauve-dim">
          {cards.length === 0 ? (
            <>Nothing on sale right now. Check back soon — or <Link href="/create" className="text-gold hover:underline">throw one yourself</Link>.</>
          ) : (
            <>No events match. Clear a filter or search something else.</>
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {results.map((c) => (
            <li key={c.id}>
              <Link href={`/e/${c.slug}`} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-plum/50">
                  {c.flyer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.flyer_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ backgroundImage: "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.30), rgba(242,89,63,0.16) 55%, transparent 85%)" }}
                    />
                  )}
                  {c.from_cents != null && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-gold backdrop-blur">
                      {c.from_cents === 0 ? "Free" : `From ${usd(c.from_cents)}`}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 font-display text-base font-semibold leading-tight text-cream group-hover:text-gold">{c.title}</p>
                <p className="mt-0.5 text-sm text-mauve-dim">{fmtDate(c.starts_at)}</p>
                <p className="truncate text-sm text-mauve-dim">{c.venue_name} · {c.city}</p>
                <p className="mt-1 truncate text-xs text-mauve-dim/80">
                  {categoryLabel(c.category, true)}
                  {c.scene_tags.length > 0 && <> · {c.scene_tags.slice(0, 3).map(sceneTagLabel).join(" · ")}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
