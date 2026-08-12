import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { ScannerClient } from "./ScannerClient";

export const dynamic = "force-dynamic";

export default async function ScanEvent({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) notFound();

  return <ScannerClient eventId={event.id} eventTitle={event.title} />;
}
