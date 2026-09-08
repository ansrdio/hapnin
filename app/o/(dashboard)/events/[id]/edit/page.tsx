import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { PageHeader } from "@/app/components/ui";
import { EditEventForm } from "./EditEventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const gaTiers = (await getTiers(id)).filter((t) => t.kind !== "table");

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit event" back={{ href: `/o/events/${id}`, label: event.title }} />
      <EditEventForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description ?? "",
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          city: event.city,
          state: event.state,
          starts_at: event.starts_at,
          capacity: event.capacity,
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
