import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryById } from "@/lib/stories";
import { listAllPlaces } from "@/lib/places";
import { getEventById } from "@/lib/events";
import { getStoryFunnel } from "@/lib/discovery";
import { buttonClass } from "@/app/components/ui";
import { StoryForm } from "../../ContentForms";
import { FunnelTable } from "../../FunnelTable";
import { setStoryStatusAction } from "../../content-actions";

export const dynamic = "force-dynamic";

export default async function AdminStory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStoryById(id);
  if (!story) notFound();
  const [places, events, funnel] = await Promise.all([listAllPlaces(), Promise.all(story.event_ids.map((e) => getEventById(e))), getStoryFunnel(story.id)]);
  const eventSlugs = events.filter(Boolean).map((e) => e!.slug);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/stories" className="text-sm text-mauve-dim hover:text-cream">← Inside the Culture</Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-cream">{story.title}</h1>
          <p className="text-sm text-mauve-dim">
            {story.status === "published" ? "Published" : "Draft — admins only"} · <Link href={`/stories/${story.slug}`} className="text-gold hover:underline">/stories/{story.slug}</Link>
          </p>
        </div>
        <form action={setStoryStatusAction}>
          <input type="hidden" name="id" value={story.id} />
          <input type="hidden" name="status" value={story.status === "published" ? "draft" : "published"} />
          <button className={buttonClass(story.status === "published" ? "secondary" : "primary")}>{story.status === "published" ? "Unpublish" : "Publish"}</button>
        </form>
      </div>

      <FunnelTable funnel={funnel} kind="story" />

      <StoryForm story={story} places={places.map((p) => ({ id: p.id, name: p.name, status: p.status }))} eventSlugs={eventSlugs} />
    </div>
  );
}
