"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createSeriesAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { buttonClass, inputClass } from "@/app/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("primary")}>
      {pending ? "Creating…" : "Create series"}
    </button>
  );
}

// The weekly night: N copies on a cadence, each its own event.
export function SeriesForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(createSeriesAction, initialActionState);
  return (
    <form action={action} className="mt-4 border-t border-plum-hi pt-4">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="font-display font-semibold text-cream">Make it a series</p>
      <p className="mt-0.5 text-sm text-mauve-dim">Same event, repeated on a schedule. Each one can be edited or cancelled on its own.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          Repeat
          <select name="cadence" defaultValue="weekly" className={`${inputClass} mt-1.5 w-44 [color-scheme:dark]`}>
            <option value="weekly">Every week</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          How many
          <input name="count" type="number" min="1" max="12" defaultValue="4" className={`${inputClass} mt-1.5 w-24`} />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-mauve-dim">
          <input type="checkbox" name="publish" className="accent-gold" />
          Publish immediately
        </label>
        <Submit />
      </div>
      {state.status === "success" && <p className="mt-3 text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="mt-3 text-sm text-coral">{state.message}</p>}
    </form>
  );
}
