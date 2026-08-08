import Link from "next/link";
import { AudienceForm } from "./components/AudienceForm";
import { OrganizerForm } from "./components/OrganizerForm";

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

export default function Page() {
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
              <Link href="/pitch" className="transition-colors hover:text-gold">
                For organizers
              </Link>
              <Link href="/why" className="transition-colors hover:text-gold">
                The case
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

          <div className="anim-rise d-5 mt-8 max-w-xl">
            <AudienceForm />
          </div>
        </div>
      </section>

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

            <div className="mt-12 border-t border-plum-hi pt-10">
              <p className="mb-6 max-w-md text-lg text-cream">
                Get on the organizer list. We&rsquo;ll set you up for your next event.
              </p>
              <div className="max-w-2xl">
                <OrganizerForm />
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

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-plum-hi px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-page flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-semibold text-cream">
            Hapnin <span className="text-mauve-dim">— hapnin.now</span>
          </p>
          <p className="text-sm text-mauve-dim">Starting in Phoenix, Arizona.</p>
        </div>
      </footer>
    </main>
  );
}
