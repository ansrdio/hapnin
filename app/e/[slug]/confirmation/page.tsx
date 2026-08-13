import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOrderByPaymentIntent } from "@/lib/orders";
import { ConfirmationPoller } from "./Poller";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You’re in — Hapnin", robots: { index: false } };

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const { payment_intent, redirect_status } = await searchParams;

  if (redirect_status && redirect_status !== "succeeded") {
    return (
      <main className="grain flex min-h-[100svh] flex-col items-center justify-center px-5 text-center">
        <div className="anim-rise">
          <h1 className="font-display text-2xl font-semibold text-cream">Payment didn’t go through.</h1>
          <p className="mt-2 text-mauve-dim">No charge was made. Head back and try again.</p>
        </div>
      </main>
    );
  }

  // Order may already be created by the webhook — if so, go straight to tickets.
  if (payment_intent) {
    const order = await getOrderByPaymentIntent(payment_intent);
    if (order) redirect(`/t/${order.id}`);
  }

  return (
    <main className="grain flex min-h-[100svh] flex-col items-center justify-center px-5 text-center">
      <div className="anim-bloom mb-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
      <h1 className="anim-rise d-1 masthead-shadow font-display text-4xl font-bold text-cream">You’re in.</h1>
      <p className="anim-rise d-2 mt-3 text-mauve-dim">Getting your ticket ready…</p>
      <ConfirmationPoller pi={payment_intent ?? ""} />
    </main>
  );
}
