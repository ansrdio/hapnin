import Link from "next/link";
import { listAllStories } from "@/lib/stories";
import { NewStoryForm } from "../ContentForms";

export const dynamic = "force-dynamic";

export default async function AdminStories() {
  const stories = await listAllStories();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-cream">Inside the Culture</h1>
        <p className="mt-1 text-mauve-dim">Stories and episodes. Drafts are visible only to admins. <Link href="/stories?preview=1" className="text-gold hover:underline">Preview the index with drafts</Link>.</p>
      </div>
      {stories.length === 0 ? (
        <p className="rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">No stories yet.</p>
      ) : (
        <ul className="divide-y divide-plum-hi rounded-2xl border border-plum-hi">
          {stories.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <Link href={`/admin/stories/${s.id}`} className="font-display text-lg font-semibold text-cream hover:text-gold">{s.title}</Link>
                <p className="text-sm text-mauve-dim">/stories/{s.slug}{s.video_url ? " · video" : ""}</p>
              </div>
              <div className="flex gap-2">
                {s.featured && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">Featured</span>}
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.status === "published" ? "bg-emerald/15 text-emerald" : "bg-plum text-mauve-dim"}`}>{s.status === "published" ? "Published" : "Draft"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NewStoryForm />
    </div>
  );
}
