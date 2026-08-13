import Link from "next/link";
import { notFound } from "next/navigation";
import { requireScanAccess } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { DoorSaleForm } from "./DoorSaleForm";

export const dynamic = "force-dynamic";

export default async function DoorSalePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { organizer } = await requireScanAccess();
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) notFound();

  const now = Date.now();
  const tiers = (await getTiers(eventId)).filter(
    (t) =>
      t.is_active &&
      t.quantity_sold < t.quantity_total &&
      (!t.sales_start_at || now >= t.sales_start_at) &&
      (!t.sales_end_at || now <= t.sales_end_at)
  );

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/scan/${eventId}`} className="text-sm text-mauve-dim hover:text-cream">← Scanner</Link>
        <span className="font-display text-sm text-cream">Box office</span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-cream">{event.title}</h1>
      <p className="mt-1 mb-6 text-mauve-dim">Sell a ticket at the door.</p>

      {tiers.length === 0 ? (
        <p className="rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">
          No tiers available to sell right now.
        </p>
      ) : (
        <DoorSaleForm eventId={eventId} tiers={tiers.map((t) => ({ id: t.id, name: t.name, price_cents: t.price_cents }))} />
      )}
    </main>
  );
}
