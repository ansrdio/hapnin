import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventBySlug, getTiers } from "@/lib/events";
import { CHECKOUT_CONSENT_TEXT } from "@/lib/checkout";
import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout — Hapnin", robots: { index: false } };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const { p } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "on_sale") notFound();

  const now = Date.now();
  const tiers = (await getTiers(event.id)).filter(
    (t) =>
      t.is_active &&
      t.quantity_sold < t.quantity_total &&
      (!t.sales_start_at || now >= t.sales_start_at) &&
      (!t.sales_end_at || now <= t.sales_end_at)
  );
  if (tiers.length === 0) notFound();

  return (
    <CheckoutClient
      slug={slug}
      eventTitle={event.title}
      consentText={CHECKOUT_CONSENT_TEXT}
      promoterCode={p ?? null}
      tiers={tiers.map((t) => ({
        id: t.id,
        name: t.name,
        price_cents: t.price_cents,
        remaining: t.quantity_total - t.quantity_sold,
      }))}
    />
  );
}
