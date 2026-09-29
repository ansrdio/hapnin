import Link from "next/link";
import { AudienceForm } from "./components/AudienceForm";
import { FlyerMarquee } from "./components/FlyerMarquee";
import { SiteHeader } from "./components/SiteHeader";
import { PlaceCard, StoryCard } from "./components/DiscoveryCards";
import { listPublishedPlaces, type PlaceRecord } from "@/lib/places";
import { listPublishedStories, type StoryRecord } from "@/lib/stories";
import type { Metadata } from "next";
import { listOnSaleEvents } from "@/lib/events";

export const revalidate = 60; // refresh the live-events strip periodically

export const metadata: Metadata = { alternates: { canonical: "/" } };

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
    label: "Reach your crowd",
    line: "Send buyers the updates they need before and after the event. Email works today, with more messaging tools coming.",
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
  // Places + Inside the Culture rows appear only once something is published.
  let places: PlaceRecord[] = [];
  let stories: StoryRecord[] = [];
  try {
    [places, stories] = await Promise.all([listPublishedPlaces(4), listPublishedStories(3)]);
  } catch {
    places = [];
    stories = [];
  }

  return (
    <main className="grain">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-page">
          <SiteHeader current="home" className="anim-rise d-1 relative z-50 mb-10 sm:mb-14" />

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
            <h1 className="relative font-brand font-bold leading-[0.86] tracking-[-0.02em]">
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
              Discover the culture around you.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-mauve-dim">
              Events, places, people and experiences that bring our cultures to life. The afrobeats
              night, the amapiano set, the Nollywood screening, the kitchen that tastes like home
              &mdash; starting with Phoenix&rsquo;s African diaspora scene.
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

      {/* ============== PLACES + INSIDE THE CULTURE (only when published) ============== */}
      {stories.length > 0 && (
        <section className="px-5 pb-16 sm:px-8 sm:pb-24" aria-labelledby="home-itc">
          <div className="mx-auto max-w-page">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 id="home-itc" className="font-display text-3xl font-semibold text-cream sm:text-4xl">Inside the Culture</h2>
                <p className="mt-1 text-mauve-dim">The people, places and stories behind the cultures around us.</p>
              </div>
              <Link href="/stories" className="hidden whitespace-nowrap font-display text-sm font-semibold text-gold hover:text-gold-hi sm:inline">All stories →</Link>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => <li key={s.id}><StoryCard story={s} /></li>)}
            </ul>
            <Link href="/stories" className="mt-5 inline-block font-display text-sm font-semibold text-gold hover:text-gold-hi sm:hidden">All stories →</Link>
          </div>
        </section>
      )}
      {places.length > 0 && (
        <section className="px-5 pb-16 sm:px-8 sm:pb-24" aria-labelledby="home-places">
          <div className="mx-auto max-w-page">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 id="home-places" className="font-display text-3xl font-semibold text-cream sm:text-4xl">Places to discover</h2>
                <p className="mt-1 text-mauve-dim">The kitchens, studios and spaces that keep our cultures close.</p>
              </div>
              <Link href="/places" className="hidden whitespace-nowrap font-display text-sm font-semibold text-gold hover:text-gold-hi sm:inline">All places →</Link>
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {places.map((p) => <li key={p.id}><PlaceCard place={p} /></li>)}
            </ul>
            <Link href="/places" className="mt-5 inline-block font-display text-sm font-semibold text-gold hover:text-gold-hi sm:hidden">All places →</Link>
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
              You bring the culture. We help you run the night.
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
              Culture travels. Finding the crowd shouldn&rsquo;t be guesswork.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-mauve-dim sm:text-xl">
              Promoters, filmmakers and organizers know their crowd at home. Once culture moves
              between cities, that picture gets harder to see. Follows, RSVPs and ticket sales show
              what people actually turn out for &mdash; giving organizers a better picture of where
              demand lives.
            </p>
            <p className="mt-4 text-base text-mauve-dim/80">
              We&rsquo;re starting with Phoenix&rsquo;s African diaspora scene and building the map city by city.
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
            <Link href="/pitch" className="hover:text-cream">For organizers</Link> ·{" "}
            <Link href="/why" className="hover:text-cream">The case</Link> ·{" "}
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
