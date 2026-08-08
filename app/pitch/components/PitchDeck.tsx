"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeeCalculator } from "./FeeCalculator";
import { PitchForm } from "./PitchForm";
import { CrowdGrowth } from "./CrowdGrowth";
import { copy, roomSources, expected, unique, trustPoints } from "../content";

type Slide = {
  key: string;
  title: string; // for screen-reader announcement
  interactive?: boolean; // no tap-to-advance overlay; user works inside
  node: React.ReactNode;
};

const slides: Slide[] = [
  {
    key: "concede",
    title: "You already have ticketing",
    node: (
      <Center>
        <p className="anim-rise d-1 mb-6 text-sm font-medium uppercase tracking-[0.3em] text-gold">
          {copy.heroEyebrow}
        </p>
        <h1 className="anim-rise d-2 font-display text-4xl font-bold leading-[1.04] text-cream sm:text-6xl">
          {copy.concedeTitle}
        </h1>
        <p className="anim-rise d-3 mt-6 text-lg leading-relaxed text-mauve-dim sm:text-xl">
          {copy.concedeDeck}
        </p>
        <p className="anim-rise d-4 mt-10 text-sm text-mauve-dim/80">
          Tap or swipe to move through &middot; about a minute
        </p>
      </Center>
    ),
  },
  {
    key: "fee",
    title: "What that fee is for",
    node: (
      <Center>
        <h2 className="anim-rise d-1 font-display text-3xl font-semibold leading-[1.1] text-cream sm:text-4xl">
          {copy.feeHeading}
        </h2>
        <p className="anim-rise d-2 mt-6 text-lg leading-relaxed text-mauve-dim">{copy.feeBody}</p>
      </Center>
    ),
  },
  {
    key: "question",
    title: "Where did your last room come from?",
    node: (
      <Center>
        <p className="anim-rise d-1 mb-6 text-sm font-medium uppercase tracking-[0.3em] text-gold">
          One question
        </p>
        <h2 className="anim-rise d-2 font-display text-[2.1rem] font-bold leading-[1.08] text-cream sm:text-6xl">
          {copy.questionHeading}
        </h2>
      </Center>
    ),
  },
  {
    key: "answer",
    title: "You did the marketing. You paid the marketplace.",
    node: (
      <Center>
        <ul className="space-y-1.5">
          {roomSources.map((s, i) => (
            <li
              key={s}
              className={`anim-rise d-${i + 1} font-display text-2xl font-semibold text-cream sm:text-3xl`}
            >
              {s}
            </li>
          ))}
        </ul>
        <p className="anim-rise d-5 mt-9 font-display text-2xl font-bold leading-[1.15] text-gold sm:text-3xl">
          {copy.answerPunch}
        </p>
        <p className="anim-rise d-5 mt-6 leading-relaxed text-mauve-dim">{copy.answerStructural}</p>
      </Center>
    ),
  },
  {
    key: "calculator",
    title: "What you would keep — calculator",
    interactive: true,
    node: (
      <Center wide>
        <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">{copy.calcHeading}</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-mauve-dim">{copy.calcSub}</p>
        <div className="mt-7">
          <FeeCalculator />
        </div>
        <p className="mt-8 border-t border-plum-hi pt-6 text-[15px] leading-relaxed text-cream/90">
          {copy.calcStripeNote}
        </p>
      </Center>
    ),
  },
  {
    key: "expected",
    title: "Everything you already expect",
    node: (
      <Center>
        <h2 className="anim-rise d-1 font-display text-3xl font-semibold text-cream sm:text-4xl">
          {copy.expectHeading}
        </h2>
        <p className="anim-rise d-1 mt-3 text-mauve-dim">{copy.expectSub}</p>
        <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {expected.map(([label, desc], i) => (
            <li key={label} className={`anim-rise d-${Math.min(i + 2, 5)} flex gap-3`}>
              <span className="mt-2 inline-block h-2 w-2 flex-none rotate-45 bg-gold" aria-hidden="true" />
              <div>
                <h3 className="font-display text-[1.05rem] font-semibold text-cream">{label}</h3>
                {desc && <p className="mt-0.5 text-[15px] leading-snug text-mauve-dim">{desc}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Center>
    ),
  },
  {
    key: "unique",
    title: "Two things you can't get anywhere else",
    node: (
      <Center>
        <h2 className="anim-rise d-1 font-display text-3xl font-semibold leading-[1.1] text-cream sm:text-4xl">
          {copy.uniqueHeading}
        </h2>
        <ul className="mt-8 space-y-7">
          {unique.map(([label, desc], i) => (
            <li key={label} className={`anim-rise d-${i + 2} flex gap-4`}>
              <span className="mt-2.5 inline-block h-2.5 w-2.5 flex-none rotate-45 bg-gold" aria-hidden="true" />
              <div>
                <h3 className="font-display text-xl font-semibold text-cream">{label}</h3>
                <p className="mt-1 leading-relaxed text-mauve-dim">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="anim-rise d-4 mt-9">
          <CrowdGrowth />
        </div>
      </Center>
    ),
  },
  {
    key: "offer",
    title: "Your first event is free",
    node: (
      <Center>
        <div className="anim-rise d-1 rounded-3xl border border-gold/45 bg-gold/[0.07] p-7 sm:p-10">
          <h2 className="font-display text-2xl font-bold leading-[1.08] text-cream sm:text-4xl">
            {copy.offerHeading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-cream/90">{copy.offerBody}</p>
          <p className="mt-5 leading-relaxed text-mauve-dim">{copy.offerBody2}</p>
        </div>
      </Center>
    ),
  },
  {
    key: "honesty",
    title: "Here's what we don't have",
    node: (
      <Center>
        <h2 className="anim-rise d-1 font-display text-3xl font-semibold leading-[1.1] text-cream sm:text-4xl">
          {copy.honestHeading}
        </h2>
        <p className="anim-rise d-2 mt-6 text-lg leading-relaxed text-mauve-dim">{copy.honestBody}</p>
        <p className="anim-rise d-3 mt-6 text-lg leading-relaxed text-cream">{copy.honestTurn}</p>
      </Center>
    ),
  },
  {
    key: "trust",
    title: "What we ask in return",
    node: (
      <Center>
        <p className="anim-rise d-1 mb-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-emerald">
          <span className="inline-block h-2 w-2 rotate-45 bg-emerald" aria-hidden="true" />
          {copy.trustEyebrow}
        </p>
        <h2 className="anim-rise d-2 font-display text-2xl font-semibold text-cream sm:text-4xl">
          {copy.trustHeading}
        </h2>
        <p className="anim-rise d-3 mt-6 text-lg leading-relaxed text-cream/90">{copy.trustBody}</p>
        <ul className="mt-7 space-y-4">
          {trustPoints.map((t, i) => (
            <li key={t} className={`anim-rise d-${i + 3} flex gap-3 leading-relaxed text-mauve-dim`}>
              <span className="mt-2.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="anim-rise d-5 mt-8 leading-relaxed text-mauve-dim">{copy.whyWeAsk}</p>
      </Center>
    ),
  },
  {
    key: "bio",
    title: "Who you are dealing with",
    node: (
      <Center>
        <h2 className="anim-rise d-1 font-display text-2xl font-semibold text-cream sm:text-4xl">
          {copy.bioHeading}
        </h2>
        <p className="anim-rise d-2 mt-6 text-lg leading-relaxed text-mauve-dim">{copy.bio}</p>
        <p className="anim-rise d-3 mt-5 text-lg leading-relaxed text-cream">{copy.bioClose}</p>
        <p className="anim-rise d-4 mt-8 text-[15px] text-mauve-dim">
          Want the fuller argument?{" "}
          <Link href="/why" className="text-cream underline decoration-gold/50 underline-offset-4 hover:decoration-gold">
            Read the case
          </Link>
          .
        </p>
      </Center>
    ),
  },
  {
    key: "ask",
    title: "Let's run one event — form",
    interactive: true,
    node: (
      <Center wide>
        <h2 className="font-display text-3xl font-bold text-cream sm:text-5xl">{copy.askHeading}</h2>
        <p className="mt-4 text-lg leading-relaxed text-mauve-dim">{copy.askBody}</p>
        <div className="mt-8">
          <PitchForm />
        </div>
      </Center>
    ),
  },
];

const N = slides.length;

function Center({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-full flex-col justify-center px-5 py-16 sm:px-8">
      <div className={`mx-auto w-full ${wide ? "max-w-2xl" : "max-w-xl"}`}>{children}</div>
    </div>
  );
}

const INTERACTIVE_SEL = "input, textarea, select, button, a, [role='slider']";

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; swipeable: boolean } | null>(null);

  // Relative steps use a functional update so rapid taps accumulate correctly
  // (no stale-index closure — a fast double-tap advances two slides, not one).
  const step = useCallback((delta: 1 | -1) => {
    setDir(delta);
    setIndex((cur) => Math.max(0, Math.min(N - 1, cur + delta)));
  }, []);
  const nextSlide = useCallback(() => step(1), [step]);
  const prevSlide = useCallback(() => step(-1), [step]);

  // Absolute jump (progress bar, Home/End).
  const jump = useCallback((i: number) => {
    setIndex((cur) => {
      setDir(i >= cur ? 1 : -1);
      return Math.max(0, Math.min(N - 1, i));
    });
  }, []);

  // Keyboard navigation — but never while a form control has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && el.matches?.(INTERACTIVE_SEL)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Home") {
        e.preventDefault();
        jump(0);
      } else if (e.key === "End") {
        e.preventDefault();
        jump(N - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextSlide, prevSlide, jump]);

  // Scroll the viewport back to top whenever the slide changes.
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [index]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    // Don't hijack swipes that begin on a control (sliders, inputs, buttons).
    const swipeable = !target.closest(INTERACTIVE_SEL);
    touch.current = { x: t.clientX, y: t.clientY, swipeable };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || !start.swipeable) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }
  }

  // Tap-to-advance (Stories idiom): left third goes back, the rest goes forward.
  // Skipped on interactive slides and whenever a real control/link is clicked.
  function onViewportClick(e: React.MouseEvent) {
    if (slides[index].interactive) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SEL)) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.clientX - rect.left < rect.width * 0.33) prevSlide();
    else nextSlide();
  }

  const slide = slides[index];

  return (
    <section
      className="relative flex h-[100svh] w-full flex-col overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Hapnin organizer pitch"
    >
      {/* Header: progress + brand + read-as-page */}
      <header className="flex-none px-4 pt-4 sm:px-6">
        <div className="flex gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1} of ${N}: ${s.title}`}
              onClick={() => jump(i)}
              className="group h-1.5 flex-1 rounded-full bg-plum-hi"
            >
              <span
                className={`block h-full rounded-full transition-colors ${
                  i <= index ? "bg-gold" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-cream">
            Hapnin
          </span>
          <Link
            href="/pitch/read"
            className="text-xs text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream"
          >
            Read as a page
          </Link>
        </div>
      </header>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className={`relative flex-1 overflow-y-auto overflow-x-hidden ${
          slide.interactive ? "" : "cursor-pointer"
        }`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onViewportClick}
        tabIndex={-1}
      >
        <div
          key={index}
          data-dir={dir}
          className="deck-slide min-h-full"
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${N}: ${slide.title}`}
        >
          {slide.node}
        </div>
      </div>

      {/* Live region for screen readers */}
      <p className="sr-only" aria-live="polite">
        Slide {index + 1} of {N}: {slide.title}
      </p>

      {/* Footer controls */}
      <footer className="flex-none px-4 pb-5 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            onClick={prevSlide}
            disabled={index === 0}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-plum-hi text-cream transition-colors hover:bg-plum disabled:opacity-30"
            aria-label="Previous slide"
          >
            <Chevron dir="left" />
          </button>

          <span className="font-display text-sm tabular-nums text-mauve-dim">
            {index + 1} / {N}
          </span>

          {index < N - 1 ? (
            <button
              onClick={nextSlide}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-gold px-5 font-display font-semibold text-ink transition-[background-color,transform] hover:bg-gold-hi active:translate-y-px"
              aria-label="Next slide"
            >
              Next
              <Chevron dir="right" />
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-plum-hi px-5 font-display text-sm text-mauve-dim hover:text-cream"
            >
              hapnin.now
            </Link>
          )}
        </div>
      </footer>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
