import { requireOrganizer } from "@/lib/auth";
import { getOrganizerRating, listOrganizerReviews } from "@/lib/reviews";
import { setReviewHiddenAction } from "@/app/o/actions";
import { PageHeader, Card, Stat, EmptyState } from "@/app/components/ui";

export const dynamic = "force-dynamic";

function fmtWhen(ms: number | null): string {
  return ms ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" }).format(new Date(ms)) : "";
}

// Ratings from people who held a ticket, after the night. Organizers can hide
// one (it stays on record) but never edit it — that's what makes them worth
// something on the public page.
export default async function ReviewsPage() {
  const { organizer } = await requireOrganizer();
  const [rating, reviews] = await Promise.all([getOrganizerRating(organizer.id), listOrganizerReviews(organizer.id, 100, true)]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Reviews"
        back={{ href: "/o", label: "Your events" }}
        subtitle="Ratings from people who went. Shown on your public page with first names only."
      />

      <div className="mb-8 grid grid-cols-2 gap-4">
        <Stat label="Average" value={rating.count ? `★ ${rating.avg.toFixed(1)}` : "—"} sub="visible ratings" />
        <Stat label="Ratings" value={rating.count} sub={`${reviews.length - rating.count} hidden`} />
      </div>

      {reviews.length === 0 ? (
        <EmptyState title="No ratings yet">
          After each event, ticket holders get a “How was it?” link on their ticket and in the morning-after email.
          Ratings land here and on your public page.
        </EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-plum-hi">
            {reviews.map((r) => (
              <li key={r.id} className={`px-5 py-4 ${r.hidden ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gold">
                      {"★".repeat(r.rating)}
                      <span className="text-plum-hi">{"★".repeat(5 - r.rating)}</span>
                      <span className="ml-2 text-xs text-mauve-dim">
                        {r.first_name ?? "A guest"} · {r.event_title} · {fmtWhen(r.created_at)}
                      </span>
                    </p>
                    {r.text && <p className="mt-1.5 leading-relaxed text-cream">“{r.text}”</p>}
                    {r.hidden && <p className="mt-1 text-xs uppercase tracking-wide text-coral">hidden from your page</p>}
                  </div>
                  <form action={setReviewHiddenAction}>
                    <input type="hidden" name="review_id" value={r.id} />
                    <input type="hidden" name="hidden" value={r.hidden ? "0" : "1"} />
                    <button className="rounded-lg border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim hover:text-cream">
                      {r.hidden ? "Show" : "Hide"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
