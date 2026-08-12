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
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-display text-2xl font-semibold text-cream">Payment didn’t go through.</h1>
        <p className="mt-2 text-mauve-dim">No charge was made. Head back and try again.</p>
      </main>
    );
  }

  // Order may already be created by the webhook — if so, go straight to tickets.
  if (payment_intent) {
    const order = await getOrderByPaymentIntent(payment_intent);
    if (order) redirect(`/t/${order.id}`);
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-cream">You’re in. 🎟️</h1>
      <p className="mt-3 text-mauve-dim">Getting your ticket ready…</p>
      <ConfirmationPoller pi={payment_intent ?? ""} />
    </main>
  );
}
