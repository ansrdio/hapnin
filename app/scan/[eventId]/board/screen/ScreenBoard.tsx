"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The projector view. Server-rendered numbers, refreshed every few seconds;
// this component's only job is the moment: when a new name comes through the
// door it takes over the screen for a few seconds — "Welcome, Ada" — so a
// guest sees themselves land on the wall as they're scanned. Client state
// (the last check-in we've shown) survives router.refresh(), which is what
// lets us tell "new" from "already on the wall".

export type ScreenStats = {
  checkedIn: number;
  sold: number;
  recent: { name: string; at: number }[];
};

export function ScreenBoard({
  title,
  whenText,
  stats,
  qrSvg,
  qrCaption,
  qrUrlText,
  refreshSeconds = 5,
}: {
  title: string;
  whenText: string;
  stats: ScreenStats;
  qrSvg: string;
  qrCaption: string;
  qrUrlText: string;
  refreshSeconds?: number;
}) {
  const router = useRouter();
  const [welcome, setWelcome] = useState<string | null>(null);
  const lastSeenAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), refreshSeconds * 1000);
    return () => clearInterval(id);
  }, [router, refreshSeconds]);

  useEffect(() => {
    const newest = stats.recent[0];
    if (lastSeenAt.current === null) {
      // First paint: everyone already inside is old news.
      lastSeenAt.current = newest?.at ?? 0;
      return;
    }
    if (newest && newest.at > lastSeenAt.current) {
      lastSeenAt.current = newest.at;
      setWelcome(newest.name);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setWelcome(null), 4500);
    }
  }, [stats]);

  const pct = stats.sold ? Math.min(100, Math.round((stats.checkedIn / stats.sold) * 100)) : 0;

  return (
    <main className="grain relative flex min-h-[100svh] flex-col overflow-hidden bg-ink px-[5vw] py-[4vh] text-cream">
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-3 text-[clamp(12px,1.4vw,20px)] font-semibold uppercase tracking-[0.3em] text-gold">
            <span className="inline-block h-[0.6em] w-[0.6em] rotate-45 bg-coral" aria-hidden="true" />
            Hapnin · live
          </p>
          <h1 className="mt-2 font-display text-[clamp(28px,4.5vw,72px)] font-bold leading-[1.02]">{title}</h1>
          <p className="mt-2 text-[clamp(14px,1.6vw,24px)] text-mauve-dim">{whenText}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[clamp(12px,1.2vw,18px)] uppercase tracking-[0.24em] text-mauve-dim">In the room</p>
          <p className="font-display text-[clamp(56px,9vw,150px)] font-bold leading-none tabular-nums">
            {stats.checkedIn}
            <span className="text-[0.4em] text-mauve-dim"> / {stats.sold}</span>
          </p>
        </div>
      </header>

      <div className="mt-[2vh] h-[1.2vh] overflow-hidden rounded-full bg-plum">
        <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      {/* Body: names ticker + QR */}
      <section className="mt-[4vh] grid flex-1 grid-cols-1 gap-[4vw] md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[clamp(12px,1.2vw,18px)] font-semibold uppercase tracking-[0.24em] text-mauve-dim">Just walked in</p>
          {stats.recent.length === 0 ? (
            <p className="mt-4 text-[clamp(18px,2.2vw,34px)] text-mauve-dim">Doors are open. First name on the wall gets the glory.</p>
          ) : (
            <ul className="mt-4 space-y-[1vh]">
              {stats.recent.slice(0, 8).map((r, i) => (
                <li
                  key={`${r.at}-${i}`}
                  className={`font-display leading-tight ${i === 0 ? "text-[clamp(30px,4.2vw,68px)] font-bold text-cream" : "text-[clamp(18px,2.4vw,38px)] text-cream/70"}`}
                  style={{ opacity: Math.max(0.25, 1 - i * 0.11) }}
                >
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col items-center justify-end self-end md:items-end">
          <div
            className="w-[clamp(140px,22vw,340px)] rounded-[2vw] bg-white p-[1.2vw] shadow-2xl shadow-black/40 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-[1.5vh] text-center font-display text-[clamp(16px,2vw,30px)] font-semibold md:text-right">{qrCaption}</p>
          <p className="text-[clamp(12px,1.2vw,18px)] text-mauve-dim">{qrUrlText}</p>
        </aside>
      </section>

      {/* The moment */}
      {welcome && (
        <div
          role="status"
          className="anim-bloom absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 text-center"
        >
          <p className="text-[clamp(16px,2vw,32px)] font-semibold uppercase tracking-[0.3em] text-gold">Welcome</p>
          <p className="mt-[2vh] px-[6vw] font-display text-[clamp(48px,12vw,220px)] font-bold leading-none text-cream">{welcome}</p>
          <p className="mt-[3vh] text-[clamp(16px,2vw,32px)] text-mauve-dim">You&rsquo;re in. 🎟️</p>
        </div>
      )}
    </main>
  );
}
