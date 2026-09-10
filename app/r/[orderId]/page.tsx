import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reviewContext } from "@/lib/reviews";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rate your night — Hapnin", robots: { index: false } };

// Reached from the ticket page and the morning-after email. The order id is
// the bearer credential — whoever holds the ticket link can rate the night.
export default async function RatePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const ctx = await reviewContext(orderId);
  if (!ctx.ok) notFound();

  return (
    <main className="grain mx-auto max-w-md px-5 py-16">
      <p className="anim-rise text-xs font-semibold uppercase tracking-[0.24em] text-gold">
        {ctx.existing ? "Update your rating" : "How was it?"}
      </p>
      <h1 className="anim-rise d-1 mt-2 font-display text-3xl font-bold leading-tight text-cream">{ctx.eventTitle}</h1>
      <p className="anim-rise d-1 mt-2 text-mauve-dim">by {ctx.organizerName}</p>

      <div className="anim-rise d-2 mt-8">
        {ctx.ended ? (
          <ReviewForm orderId={orderId} organizerHandle={ctx.organizerHandle} existing={ctx.existing} />
        ) : (
          <p className="rounded-2xl border border-plum-hi bg-plum/40 px-5 py-4 text-mauve-dim">
            The night hasn&rsquo;t happened yet — come back afterwards and tell us how it was.
          </p>
        )}
      </div>
      <p className="anim-rise d-3 mt-8 text-xs text-mauve-dim">
        Your rating shows on {ctx.organizerName}&rsquo;s page with your first name only. One rating per ticket; you can
        change it any time from this link.
      </p>
    </main>
  );
}
