import { requireOwner } from "@/lib/auth";
import { PageHeader } from "@/app/components/ui";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { organizer } = await requireOwner();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" subtitle="How you show up on your public page." back={{ href: "/o", label: "Your events" }} />
      <ProfileForm
        profile={{
          name: organizer.name,
          bio: organizer.bio ?? "",
          instagram: organizer.instagram_handle ?? "",
          avatar_url: organizer.avatar_url ?? "",
          handle: organizer.handle,
        }}
      />
    </div>
  );
}
