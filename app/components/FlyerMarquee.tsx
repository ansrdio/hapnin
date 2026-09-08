import Link from "next/link";

type Item = { slug: string; title: string; flyer_url: string | null };

// A seamless scrolling strip of live event flyers. The track holds the list
// twice and slides -50%, so the loop is continuous. Pauses on hover and for
// reduced-motion (see globals.css). Links each flyer to its event.
export function FlyerMarquee({ events }: { events: Item[] }) {
  if (events.length === 0) return null;
  const items = [...events, ...events];

  return (
    <div className="relative overflow-hidden py-1">
      <div className="marquee-track flex w-max gap-4 px-4">
        {items.map((e, i) => (
          <Link
            key={i}
            href={`/e/${e.slug}`}
            aria-label={e.title}
            className="group relative block h-56 w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-plum/50 sm:h-64 sm:w-52"
          >
            {e.flyer_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.flyer_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                className="flex h-full w-full items-end p-3"
                style={{
                  backgroundImage:
                    "radial-gradient(80% 80% at 50% 20%, rgba(244,178,76,0.30), rgba(242,89,63,0.16) 55%, transparent 85%)",
                }}
              >
                <span className="font-display text-sm font-semibold text-cream">{e.title}</span>
              </div>
            )}
          </Link>
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent sm:w-28" />
    </div>
  );
}
