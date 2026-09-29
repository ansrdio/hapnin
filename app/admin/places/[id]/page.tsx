import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceById } from "@/lib/places";
import { listEventsForPlace } from "@/lib/events";
import { listStoriesForPlace } from "@/lib/stories";
import { getPlaceFunnel } from "@/lib/discovery";
import { Card, buttonClass } from "@/app/components/ui";
import { PlaceForm, LinkEventForm } from "../../ContentForms";
import { FunnelTable } from "../../FunnelTable";
import { setPlaceStatusAction, unlinkEventFromPlaceAction } from "../../content-actions";

export const dynamic = "force-dynamic";

export default async function AdminPlace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(id);
  if (!place) notFound();
  const [events, stories, funnel] = await Promise.all([listEventsForPlace(place.id), listStoriesForPlace(place.id), getPlaceFunnel(place.id)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/places" className="text-sm text-mauve-dim hover:text-cream">← Places</Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-cream">{place.name}</h1>
          <p className="text-sm text-mauve-dim">
            {place.status === "published" ? "Published" : "Draft — admins only"} · <Link href={`/places/${place.slug}`} className="text-gold hover:underline">/places/{place.slug}</Link>
          </p>
        </div>
        <form action={setPlaceStatusAction}>
          <input type="hidden" name="id" value={place.id} />
          <input type="hidden" name="status" value={place.status === "published" ? "draft" : "published"} />
          <button className={buttonClass(place.status === "published" ? "secondary" : "primary")}>{place.status === "published" ? "Unpublish" : "Publish"}</button>
        </form>
      </div>

      <FunnelTable funnel={funnel} kind="place" />

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Events hosted here</p>
        {events.length === 0 ? (
          <p className="text-sm text-mauve-dim">None linked. Only on-sale, upcoming events appear on the public page.</p>
        ) : (
          <ul className="divide-y divide-plum-hi">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-cream">
                  <Link href={`/e/${e.slug}`} className="hover:text-gold">{e.title}</Link> <span className="text-mauve-dim">· {e.status}{e.is_sample ? " · sample" : ""}</span>
                </span>
                <form action={unlinkEventFromPlaceAction}>
                  <input type="hidden" name="event_id" value={e.id} />
                  <input type="hidden" name="place_id" value={place.id} />
                  <button className="text-sm text-coral hover:underline">Unlink</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <LinkEventForm placeId={place.id} />
      </Card>

      <Card className="space-y-2">
        <p className="font-display font-semibold text-cream">Stories about this place</p>
        {stories.length === 0 ? (
          <p className="text-sm text-mauve-dim">None yet. Create a story and tick this place under Relationships.</p>
        ) : (
          <ul className="text-sm">
            {stories.map((s) => (
              <li key={s.id}><Link href={`/admin/stories/${s.id}`} className="text-cream hover:text-gold">{s.title}</Link> <span className="text-mauve-dim">· {s.status}</span></li>
            ))}
          </ul>
        )}
      </Card>

      <PlaceForm place={place} />
    </div>
  );
}
