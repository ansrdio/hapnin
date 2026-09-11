import { requireOrganizer } from "@/lib/auth";
import { PageHeader } from "@/app/components/ui";
import { EventBuilder } from "./EventBuilder";

export const dynamic = "force-dynamic";

// `?template=afrobeats-night` preselects a template (used by the dashboard's
// quick-start tiles and by launch-night deep links).
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireOrganizer(); // guard; the form posts to an organizer-scoped action
  const { template } = await searchParams;
  return (
    <div className="max-w-2xl">
      <PageHeader title="New event" back={{ href: "/o", label: "Your events" }} />
      <EventBuilder initialTemplateId={template ?? null} />
    </div>
  );
}
