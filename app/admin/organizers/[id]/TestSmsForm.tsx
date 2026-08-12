"use client";

import { useActionState } from "react";
import { sendTestSmsAction } from "../../actions";
import { initialActionState } from "../../action-state";

export function TestSmsForm({ organizerId }: { organizerId: string }) {
  const [state, action] = useActionState(sendTestSmsAction, initialActionState);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="organizer_id" value={organizerId} />
      <button className="rounded-xl border border-plum-hi px-5 py-3 font-display text-cream transition-colors hover:bg-plum">
        Send test SMS
      </button>
      {state.status === "success" && <p className="mt-3 text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && <p className="mt-3 text-sm text-coral">{state.message}</p>}
    </form>
  );
}
