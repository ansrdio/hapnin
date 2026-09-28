import Link from "next/link";
import { Wordmark } from "./Brand";

// The shared top bar for the public discovery pages (home, Events, Places,
// Inside the Culture). Desktop: the four destinations inline. Phone: the
// wordmark, Create event, and a Menu disclosure (native <details>, no JS) so
// "Inside the Culture" keeps its full name instead of being squeezed.

type Section = "home" | "events" | "places" | "culture";

const LINKS: { href: string; label: string; section: Section }[] = [
  { href: "/discover", label: "Events", section: "events" },
  { href: "/places", label: "Places", section: "places" },
  { href: "/stories", label: "Inside the Culture", section: "culture" },
];

export function SiteHeader({ current, className = "" }: { current?: Section; className?: string }) {
  return (
    <header className={`flex items-center justify-between gap-4 ${className}`}>
      <Link href="/" aria-label="Hapnin home" className="text-cream transition-opacity hover:opacity-80">
        <Wordmark height={26} />
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-7 text-sm font-medium uppercase tracking-[0.16em] text-mauve-dim md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current === l.section ? "page" : undefined} className={`transition-colors hover:text-gold ${current === l.section ? "text-cream" : ""}`}>
            {l.label}
          </Link>
        ))}
        <Link href="/create" className="whitespace-nowrap rounded-full bg-gold px-4 py-1.5 font-display text-sm font-semibold normal-case tracking-normal text-ink transition-colors hover:bg-gold-hi">
          Create event
        </Link>
      </nav>

      <div className="flex items-center gap-2 md:hidden">
        <Link href="/create" className="whitespace-nowrap rounded-full bg-gold px-3.5 py-1.5 font-display text-xs font-semibold text-ink transition-colors hover:bg-gold-hi">
          Create event
        </Link>
        <details className="group relative">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-plum-hi px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream [&::-webkit-details-marker]:hidden">
            Menu
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <nav aria-label="Primary" className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-plum-hi bg-plum p-2 shadow-2xl shadow-black/40">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current === l.section ? "page" : undefined} className={`block rounded-xl px-4 py-3 font-display text-base font-semibold hover:bg-plum-hi ${current === l.section ? "text-gold" : "text-cream"}`}>
                {l.label}
              </Link>
            ))}
            <Link href="/pitch" className="block rounded-xl px-4 py-3 text-sm text-mauve-dim hover:bg-plum-hi hover:text-cream">For organizers</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
