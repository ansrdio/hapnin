import Link from "next/link";
import { listAllPlaces } from "@/lib/places";
import { placeCategoryLabel } from "@/lib/taxonomy";
import { NewPlaceForm } from "../ContentForms";

export const dynamic = "force-dynamic";

export default async function AdminPlaces() {
  const places = await listAllPlaces();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-cream">Places</h1>
        <p className="mt-1 text-mauve-dim">Culturally relevant businesses and spaces. Drafts are visible only to admins. <Link href="/places?preview=1" className="text-gold hover:underline">Preview the index with drafts</Link>.</p>
      </div>
      {places.length === 0 ? (
        <p className="rounded-2xl border border-plum-hi bg-plum/40 p-6 text-mauve-dim">No places yet.</p>
      ) : (
        <ul className="divide-y divide-plum-hi rounded-2xl border border-plum-hi">
          {places.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <Link href={`/admin/places/${p.id}`} className="font-display text-lg font-semibold text-cream hover:text-gold">{p.name}</Link>
                <p className="text-sm text-mauve-dim">{placeCategoryLabel(p.category)} · {p.city} · /places/{p.slug}</p>
              </div>
              <div className="flex gap-2">
                {p.featured && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">Featured</span>}
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${p.status === "published" ? "bg-emerald/15 text-emerald" : "bg-plum text-mauve-dim"}`}>{p.status === "published" ? "Published" : "Draft"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NewPlaceForm />
    </div>
  );
}
