"use client";

import { useActionState } from "react";
import { createEventAction } from "../../actions";
import { initialActionState } from "../../action-state";
import { ClassificationFields } from "@/app/components/ClassificationFields";

const field =
  "w-full rounded-lg border border-plum-hi bg-ink/40 px-3 py-2.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const label = "mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-gold";

export function CreateEventForm({ organizerId }: { organizerId: string }) {
  const [state, action] = useActionState(createEventAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="organizer_id" value={organizerId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Title</label>
          <input name="title" className={field} placeholder="Amapiano Sundays" />
          {err.title && <p className="mt-1 text-sm text-coral">{err.title}</p>}
        </div>
        <div>
          <label className={label}>Slug (URL)</label>
          <input name="slug" className={field} placeholder="amapiano-sundays" />
          {err.slug && <p className="mt-1 text-sm text-coral">{err.slug}</p>}
        </div>
        <div>
          <label className={label}>Date &amp; time (Phoenix)</label>
          <input type="datetime-local" name="starts_at" className={`${field} [color-scheme:dark]`} />
          {err.starts_at && <p className="mt-1 text-sm text-coral">{err.starts_at}</p>}
        </div>
        <div>
          <label className={label}>Capacity (optional)</label>
          <input name="capacity" type="number" className={field} placeholder="300" />
        </div>
        <div>
          <label className={label}>Venue name</label>
          <input name="venue_name" className={field} placeholder="The Van Buren" />
          {err.venue_name && <p className="mt-1 text-sm text-coral">{err.venue_name}</p>}
        </div>
        <div>
          <label className={label}>Venue address</label>
          <input name="venue_address" className={field} placeholder="401 W Van Buren St" />
          {err.venue_address && <p className="mt-1 text-sm text-coral">{err.venue_address}</p>}
        </div>
        <div>
          <label className={label}>City</label>
          <input name="city" className={field} placeholder="Phoenix" defaultValue="Phoenix" />
          {err.city && <p className="mt-1 text-sm text-coral">{err.city}</p>}
        </div>
        <div>
          <label className={label}>State</label>
          <input name="state" className={field} placeholder="AZ" defaultValue="AZ" />
          {err.state && <p className="mt-1 text-sm text-coral">{err.state}</p>}
        </div>
      </div>

      <div>
        <label className={label}>Description (optional)</label>
        <textarea name="description" rows={2} className={`${field} resize-none`} />
      </div>

      {/* Classification */}
      <ClassificationFields errors={err} />

      <div>
        <label className={label}>Talent (comma-separated, optional)</label>
        <input name="talent" className={field} placeholder="Uncle Waffles, Major League DJz" />
      </div>

      {/* Tiers */}
      <div>
        <label className={label}>Tiers</label>
        {[0, 1].map((i) => (
          <div key={i} className="mt-2 grid grid-cols-[1fr_90px_90px] gap-2">
            <input name="tier_name" className={field} placeholder={i === 0 ? "General" : "VIP (optional)"} />
            <input name="tier_price" type="number" step="0.01" className={field} placeholder="$" />
            <input name="tier_qty" type="number" className={field} placeholder="qty" />
          </div>
        ))}
        {err.tiers && <p className="mt-1 text-sm text-coral">{err.tiers}</p>}
      </div>

      <button className="rounded-xl bg-gold px-6 py-3 font-display font-semibold text-ink transition-colors hover:bg-gold-hi">
        Create event
      </button>
      {state.status === "success" && <p className="mt-2 text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="mt-2 text-sm text-coral">{state.message}</p>}
    </form>
  );
}
