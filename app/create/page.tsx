import Link from "next/link";
import type { Metadata } from "next";
import { GuestEventBuilder } from "./GuestEventBuilder";

export const metadata: Metadata = {
  title: "Create an event",
  description: "Build your event on Hapnin — no account needed to start.",
};

export default function CreateEventPage() {
  return (
    <main className="grain min-h-[100svh]">
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 lg:py-20">
        <div className="anim-rise">
          <Link href="/" className="text-sm text-mauve-dim transition-colors hover:text-cream">
            ← Hapnin
          </Link>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-cream sm:text-5xl">
            Create your event
          </h1>
          <p className="mt-3 text-mauve-dim">
            Build it now — no account needed to start. You’ll sign in at the end to publish and get paid.
          </p>
        </div>
        <div className="anim-rise d-1 mt-8">
          <GuestEventBuilder />
        </div>
      </div>
    </main>
  );
}
