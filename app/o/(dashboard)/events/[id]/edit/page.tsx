import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { PageHeader } from "@/app/components/ui";
import { EditEventForm } from "./EditEventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicated?: string }>;
}) {
  const { id } = await params;
  const { duplicated } = await searchParams;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const gaTiers = (await getTiers(id)).filter((t) => t.kind !== "table");

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit event" back={{ href: `/o/events/${id}`, label: event.title }} />

      {duplicated === "1" && (
        <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/[0.06] px-5 py-4">
          <p className="font-display font-semibold text-cream">Copied — this is a new draft.</p>
          <p className="mt-0.5 text-sm text-mauve-dim">
            Set the real date, check the tiers and flyer, then publish from the event page. Nothing is live
            until you do.
          </p>
        </div>
      )}
      <EditEventForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description ?? "",
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          venue_zip: event.venue_zip ?? "",
          city: event.city,
          state: event.state,
          starts_at: event.starts_at,
          capacity: event.capacity,
          refund_policy: event.refund_policy,
          referral_off_cents: event.referral_off_cents,
          event_type: event.event_type,
          community: event.community,
          primary_language: event.primary_language,
          genre: event.genre,
          talent: event.talent,
        }}
        tiers={gaTiers.map((t) => ({
          id: t.id,
          name: t.name,
          price_cents: t.price_cents,
          quantity_total: t.quantity_total,
          quantity_sold: t.quantity_sold,
          is_active: t.is_active,
        }))}
      />
    </div>
  );
}
