import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { setEventStatusAction, setEventFlyerAction } from "@/app/o/actions";
import { FlyerUpload } from "@/app/components/FlyerUpload";
import {
  PageHeader,
  Card,
  Stat,
  StatusBadge,
  LinkButton,
  buttonClass,
  money,
} from "@/app/components/ui";
import { ShareLink } from "./ShareLink";

export const dynamic = "force-dynamic";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusButton({ eventId, status, label, variant }: { eventId: string; status: string; label: string; variant: "primary" | "secondary" | "danger" }) {
  return (
    <form action={setEventStatusAction}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="status" value={status} />
      <button className={buttonClass(variant)}>{label}</button>
    </form>
  );
}

export default async function ManageEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const tiers = await getTiers(id);

  const capacity = event.capacity ?? tiers.reduce((a, t) => a + t.quantity_total, 0);
  const remaining = Math.max(0, capacity - event.tickets_sold);
  const publicUrl = `https://hapnin.now/e/${event.slug}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={event.title}
        back={{ href: "/o", label: "Your events" }}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={event.status} /> · {fmtDate(event.starts_at)}
          </span>
        }
        action={
          event.status === "on_sale" ? (
            <LinkButton href={`/e/${event.slug}`} variant="secondary" target="_blank">
              View public page ↗
            </LinkButton>
          ) : undefined
        }
      />

      {/* Publish controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {event.status === "draft" && (
            <>
              <StatusButton eventId={event.id} status="on_sale" label="Publish — go on sale" variant="primary" />
              <span className="text-sm text-mauve-dim">Draft — not visible to buyers yet.</span>
            </>
          )}
          {event.status === "on_sale" && (
            <>
              <StatusButton eventId={event.id} status="draft" label="Unpublish" variant="secondary" />
              <StatusButton eventId={event.id} status="cancelled" label="Cancel event" variant="danger" />
            </>
          )}
          {event.status === "cancelled" && (
            <StatusButton eventId={event.id} status="draft" label="Reopen as draft" variant="secondary" />
          )}
          {event.status === "sold_out" && (
            <StatusButton eventId={event.id} status="on_sale" label="Reopen sales" variant="secondary" />
          )}
        </div>
      </Card>

      {/* Live numbers */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Sold" value={event.tickets_sold} sub={`${remaining} left`} />
        <Stat label="Gross" value={money(event.gross_cents)} />
        <Stat label="Checked in" value={event.checked_in} sub={`of ${event.tickets_sold}`} />
        <Stat label="Capacity" value={capacity} />
      </div>

      {/* Tiers */}
      <Card className="mb-6">
        <p className="mb-4 font-display font-semibold text-cream">Tiers</p>
        <div className="divide-y divide-plum-hi">
          {tiers.map((t) => {
            const left = Math.max(0, t.quantity_total - t.quantity_sold);
            return (
              <div key={t.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-cream">{t.name}</p>
                  <p className="text-sm text-mauve-dim">{money(t.price_cents)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold tabular-nums text-cream">
                    {t.quantity_sold}
                    <span className="text-mauve-dim">/{t.quantity_total}</span>
                  </p>
                  <p className="text-sm text-mauve-dim">{left} left</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Flyer */}
      <Card className="mb-6">
        <p className="mb-4 font-display font-semibold text-cream">Flyer</p>
        <form action={setEventFlyerAction} className="space-y-4">
          <input type="hidden" name="event_id" value={event.id} />
          <FlyerUpload initialUrl={event.flyer_url ?? ""} />
          <button className={buttonClass("secondary")}>Save flyer</button>
        </form>
      </Card>

      {/* Share + door */}
      <Card>
        <p className="mb-4 font-display font-semibold text-cream">Share & run the door</p>
        <ShareLink url={publicUrl} disabled={event.status !== "on_sale"} />
        <div className="mt-4 flex flex-wrap gap-3">
          <LinkButton href={`/scan/${event.id}`} variant="secondary">
            Open door scanner
          </LinkButton>
          {event.status === "on_sale" && (
            <LinkButton href={`/e/${event.slug}`} variant="ghost" target="_blank">
              Preview ↗
            </LinkButton>
          )}
        </div>
      </Card>
    </div>
  );
}
