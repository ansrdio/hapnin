import { requireOrganizer } from "@/lib/auth";
import { PageHeader } from "@/app/components/ui";
import { EventBuilder } from "./EventBuilder";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireOrganizer(); // guard; the form posts to an organizer-scoped action
  return (
    <div className="max-w-2xl">
      <PageHeader title="New event" back={{ href: "/o", label: "Your events" }} />
      <EventBuilder />
    </div>
  );
}
