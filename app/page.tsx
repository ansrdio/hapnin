import Link from "next/link";
import { AudienceForm } from "./components/AudienceForm";
import { FlyerMarquee } from "./components/FlyerMarquee";
import { listOnSaleEvents } from "@/lib/events";

export const revalidate = 60; // refresh the live-events strip periodically

const organizerPoints = [
  {
    label: "Tickets in minutes",
    line: "Set up an event and start selling. No spreadsheet, no group chat, no chasing transfers.",
  },
  {
    label: "A door that works",
    line: "Scan tickets from your phone. Keeps working when the venue wifi doesn’t.",
  },
  {
    label: "Message your crowd",
    line: "Text everyone who bought, from your own account. Doors moved, running late, next event.",
  },
  {
    label: "Keep your people",
    line: "Your audience carries from one event to the next, and grows.",
  },
];

export default async function Page() {
  // Degrade gracefully if the data layer is unavailable (e.g. build without creds).
  let liveEvents: { slug: string; title: string; flyer_url: string | null; starts_at: number }[] = [];
  try {
    liveEvents = (await listOnSaleEvents(16)).map((e) => ({
      slug: e.slug,
      title: e.title,
      flyer_url: e.flyer_url,
      starts_at: e.starts_at,
    }));
  } catch {
    liveEvents = [];
  }

  return (
    <main className="grain">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-page">
          <header className="anim-rise d-1 mb-10 flex items-center justify-between gap-4 sm:mb-14">
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-gold">
              <span className="inline-block h-2 w-2 rotate-45 bg-coral" aria-hidden="true" />
              Hapnin
            </p>
            <nav aria-label="Primary" className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.16em] text-mauve-dim sm:gap-7 sm:text-sm sm:tracking-[0.18em]">
              <Link href="/discover" className="transition-colors hover:text-gold">
                Events
              </Link>
              <Link href="/pitch" className="hidden transition-colors hover:text-gold sm:inline">
                For organizers
              </Link>
              <Link href="/why" className="hidden transition-colors hover:text-gold sm:inline">
                The case
              </Link>
              <Link
                href="/create"
                className="whitespace-nowrap rounded-full bg-gold px-4 py-1.5 font-display text-xs font-semibold normal-case tracking-normal text-ink transition-colors hover:bg-gold-hi sm:text-sm"
              >
                Create event
              </Link>
            </nav>
          </header>

          {/* Signature: the flyer masthead + spotlight bloom */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="anim-bloom pointer-events-none absolute -left-[10%] -top-[30%] h-[150%] w-[85%] rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(244,178,76,0.55), rgba(242,89,63,0.22) 52%, transparent 78%)",
                filter: "blur(8px)",
              }}
            />
            <h1 className="relative font-display font-bold leading-[0.86] tracking-[-0.02em]">
              <span className="anim-rise d-2 block text-[clamp(3.25rem,17vw,10.5rem)] text-cream masthead-shadow">
                What&rsquo;s
              </span>
              <span className="anim-rise d-3 block text-[clamp(3.25rem,17vw,10.5rem)] text-gold masthead-shadow-gold">
                hapnin
              </span>
              <span className="anim-rise d-4 block text-[clamp(3.25rem,17vw,10.5rem)] text-gold masthead-shadow-gold">
                ?
              </span>
            </h1>
          </div>

          <div className="anim-rise d-5 mt-8 max-w-xl">
            <p className="font-display text-2xl font-semibold text-cream sm:text-3xl">
              Plenty. You just never heard about it.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-mauve-dim">
              The afrobeats night. The amapiano set. The Nollywood screening. The comedy show. The
              culture festival. African events in your city move through group chats you&rsquo;re
              not in &mdash; Hapnin puts them in one place.
            </p>
          </div>

          <div className="anim-rise d-5 mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/discover"
              className="rounded-xl bg-gold px-8 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi"
            >
              See what&rsquo;s on
            </Link>
            <span className="text-sm text-mauve-dim">Live in Phoenix now</span>
          </div>

          <div className="anim-rise d-5 mt-8 max-w-xl">
            <p className="mb-3 text-sm text-mauve-dim">Or get a text when new ones drop near you:</p>
            <AudienceForm />
          </div>
        </div>
      </section>

      {/* ============== LIVE FLYER MARQUEE ============== */}
      {liveEvents.length > 0 && (
        <section className="pb-16 sm:pb-24" aria-label="Live events">
          <FlyerMarquee events={liveEvents} />
          <div className="mx-auto mt-6 max-w-page px-5 sm:px-8">
            <Link href="/discover" className="font-display text-sm font-semibold text-gold transition-colors hover:text-gold-hi">
              See all events →
            </Link>
          </div>
        </section>
      )}

      {/* ============== FOR PEOPLE WHO GO OUT ============== */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-page">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-semibold leading-[1.05] text-cream sm:text-5xl">
              The best night you missed was three miles away.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mauve-dim sm:text-xl">
              You find out on Monday. Someone posts the video, the room is packed, and you were
              home. It&rsquo;s not that nothing&rsquo;s happening — it&rsquo;s that nobody told you.
            </p>
          </div>
        </div>
      </section>

      {/* ================== FOR ORGANIZERS ================== */}
      <section id="organizers" className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-page">
          <div className="rounded-3xl border border-plum-hi bg-plum p-7 sm:p-12">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-gold">
              For organizers
            </p>
            <h2 className="max-w-2xl font-display text-3xl font-semibold leading-[1.05] text-cream sm:text-5xl">
              You bring the culture. We fill the room.
            </h2>

            <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
              {organizerPoints.map((p) => (
                <li key={p.label} className="flex gap-4">
                  <span
                    className="mt-2 inline-block h-2.5 w-2.5 flex-none rotate-45 bg-gold"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-display text-xl font-semibold text-cream">{p.label}</h3>
                    <p className="mt-1 leading-relaxed text-mauve-dim">{p.line}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-12 flex flex-col gap-5 border-t border-plum-hi pt-10 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-lg text-cream">
                Set up your next event in minutes. No account needed to start — payouts land in your own account.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/create"
                  className="rounded-xl bg-gold px-7 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi"
                >
                  Create your event
                </Link>
                <Link href="/login?next=/o" className="text-sm text-mauve-dim transition-colors hover:text-cream">
                  Already host? Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================== THE BIGGER THING ================== */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-page">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-emerald">
              <span className="inline-block h-2 w-2 rotate-45 bg-emerald" aria-hidden="true" />
              The map
            </p>
            <h2 className="font-display text-3xl font-semibold leading-[1.05] text-cream sm:text-5xl">
              Culture leaves home. Nobody&rsquo;s tracking where it lands.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mauve-dim sm:text-xl">
              Nigerian films can&rsquo;t reach audiences abroad because no one knows where those
              audiences are. Not which city, not which crowd, not what they&rsquo;d turn out for.
              Every ticket sold here answers a little of that. We&rsquo;re building the map.
            </p>
          </div>
        </div>
      </section>

      {/* ================== TWO DOORS ================== */}
      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto grid max-w-page gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="flex flex-col justify-between rounded-3xl border border-plum-hi bg-plum/50 p-8 sm:p-10">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-gold">Going out</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-cream sm:text-4xl">Find your night.</h3>
              <p className="mt-2 text-mauve-dim">Browse what&rsquo;s on near you and grab your spot.</p>
            </div>
            <Link
              href="/discover"
              className="mt-8 inline-block w-fit rounded-xl bg-gold px-7 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi"
            >
              Explore events
            </Link>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border border-plum-hi bg-plum/50 p-8 sm:p-10">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-coral">Throwing one</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-cream sm:text-4xl">Fill your room.</h3>
              <p className="mt-2 text-mauve-dim">Set up an event in minutes — payouts to your own account.</p>
            </div>
            <Link
              href="/create"
              className="mt-8 inline-block w-fit rounded-xl border border-gold px-7 py-3.5 font-display font-semibold text-gold transition-colors hover:bg-gold hover:text-ink"
            >
              Create an event
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-plum-hi px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-page flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-semibold text-cream">
            Hapnin <span className="text-mauve-dim">— hapnin.now</span>
          </p>
          <p className="text-sm text-mauve-dim">
            Starting in Phoenix, Arizona. ·{" "}
            <Link href="/tickets" className="hover:text-cream">Find my tickets</Link> ·{" "}
            <Link href="/terms" className="hover:text-cream">Terms</Link> ·{" "}
            <Link href="/privacy" className="hover:text-cream">Privacy</Link> ·{" "}
            <a href="mailto:jii@hapnin.now" className="hover:text-cream">jii@hapnin.now</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
