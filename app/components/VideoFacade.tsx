"use client";

import { useState } from "react";
import { track } from "./Track";

// Story video: a thumbnail and a real <button> until someone taps play; only
// then is the YouTube/Vimeo iframe (and its scripts) loaded. Captions are the
// player's own (CC button); nothing custom to break.

export function VideoFacade({
  embedUrl,
  thumbnailUrl,
  title,
  storyId,
  watchUrl,
}: {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string;
  storyId: string;
  watchUrl: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-ink">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setPlaying(true);
          track("story_video_played", { story_id: storyId });
        }}
        className="group relative block aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-plum/60 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        aria-label={`Play video: ${title}`}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(80% 80% at 50% 30%, rgba(244,178,76,0.30), rgba(242,89,63,0.16) 55%, transparent 85%)" }} />
        )}
        <span className="absolute inset-0 bg-ink/25 transition-colors group-hover:bg-ink/10" aria-hidden="true" />
        <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-ink shadow-2xl shadow-black/40 transition-transform group-hover:scale-105" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </button>
      <p className="mt-2 text-xs text-mauve-dim">
        Plays from {watchUrl.includes("vimeo") ? "Vimeo" : "YouTube"} when you tap it. Captions are in the player&rsquo;s CC menu.{" "}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
          Open in {watchUrl.includes("vimeo") ? "Vimeo" : "YouTube"}
        </a>
      </p>
    </div>
  );
}
