import type { Metadata } from "next";
import Link from "next/link";
import { FindTicketsForm } from "./FindTicketsForm";

export const metadata: Metadata = {
  title: "Find my tickets — Hapnin",
  description: "Lost the link? Enter the email or phone you bought with and we'll send your tickets again.",
};

export default function FindTicketsPage() {
  return (
    <main className="grain mx-auto max-w-md px-5 py-16">
      <p className="anim-rise text-xs font-semibold uppercase tracking-[0.24em] text-gold">Lost the link?</p>
      <h1 className="anim-rise d-1 mt-2 font-display text-3xl font-bold text-cream">Find my tickets.</h1>
      <p className="anim-rise d-1 mt-3 leading-relaxed text-mauve-dim">
        Enter the email or mobile number you bought with. We&rsquo;ll email your upcoming ticket links to the
        address on file — nothing is shown here, so no one else can look you up.
      </p>
      <div className="anim-rise d-2 mt-8">
        <FindTicketsForm />
      </div>
      <p className="anim-rise d-3 mt-10 text-sm text-mauve-dim">
        Bought with a phone number and no email? Reply to your ticket text, or reach the organizer from the
        event page.{" "}
        <Link href="/discover" className="text-gold hover:underline">
          Browse events
        </Link>
      </p>
    </main>
  );
}
