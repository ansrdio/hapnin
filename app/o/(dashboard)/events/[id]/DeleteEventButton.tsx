"use client";

import { deleteEventAction } from "@/app/o/actions";
import { buttonClass } from "@/app/components/ui";

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  return (
    <form
      action={deleteEventAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${title}"? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      <button className={buttonClass("danger")}>Delete event</button>
    </form>
  );
}
