import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getEventGuests } from "@/lib/attendees";
import { PageHeader, Card, Stat } from "@/app/components/ui";
import { GuestTable } from "./GuestTable";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();

  const guests = await getEventGuests(id);
  const paid = guests.filter((g) => g.status === "paid");
  const attendees = paid.reduce((a, g) => a + g.quantity, 0);
  const checkedIn = paid.reduce((a, g) => a + g.checkedIn, 0);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Guest list" subtitle={event.title} back={{ href: `/o/events/${id}`, label: event.title }} />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Orders" value={paid.length} />
        <Stat label="Attendees" value={attendees} />
        <Stat label="Checked in" value={checkedIn} sub={`of ${attendees}`} />
      </div>

      {guests.length === 0 ? (
        <Card className="text-center text-mauve-dim">No guests yet.</Card>
      ) : (
        <GuestTable eventId={id} guests={guests} />
      )}
    </div>
  );
}
