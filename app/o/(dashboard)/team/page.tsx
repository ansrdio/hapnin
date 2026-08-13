import { requireOwner } from "@/lib/auth";
import { listTeamMembers } from "@/lib/team";
import { removeTeamMemberAction } from "@/app/o/actions";
import { PageHeader, Card, EmptyState } from "@/app/components/ui";
import { AddMemberForm } from "./AddMemberForm";

export const dynamic = "force-dynamic";

const ROLE_COPY: Record<string, string> = {
  manager: "Full dashboard + event management",
  door: "Door scanner only",
};

export default async function TeamPage() {
  const { organizer } = await requireOwner();
  const members = await listTeamMembers(organizer.id);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Team"
        back={{ href: "/o", label: "Your events" }}
        subtitle="Add people to help run your events. They sign in with the email you add here."
      />

      <Card className="mb-6">
        <p className="mb-4 font-display font-semibold text-cream">Add a team member</p>
        <AddMemberForm />
      </Card>

      {members.length === 0 ? (
        <EmptyState title="No team members yet">
          Add a manager to help build and manage events, or door staff who can only scan tickets.
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-plum-hi">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-cream">
                    {m.name || m.email} <span className="ml-1 text-xs uppercase tracking-wide text-gold">{m.role}</span>
                  </p>
                  <p className="text-sm text-mauve-dim">
                    {m.name ? `${m.email} · ` : ""}
                    {ROLE_COPY[m.role]}
                  </p>
                </div>
                <form action={removeTeamMemberAction}>
                  <input type="hidden" name="email" value={m.email} />
                  <button className="text-sm text-mauve-dim transition-colors hover:text-coral">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
