"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { broadcastAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Textarea, buttonClass } from "@/app/components/ui";

const MAX = 320;

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={buttonClass("secondary")}>
      {pending ? "Sending…" : "Send broadcast"}
    </button>
  );
}

export function BroadcastForm({ eventId, audience, smsOff = false }: { eventId: string; audience: number; smsOff?: boolean }) {
  const [state, action] = useActionState(broadcastAction, initialActionState);
  const [len, setLen] = useState(0);
  const err = state.fieldErrors ?? {};

  // Never show a form that would "send" to nowhere. Until texting is switched
  // on, say so plainly rather than let an organizer believe buyers were reached.
  if (smsOff) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm">
        <p className="font-medium text-cream">Texting isn’t switched on yet.</p>
        <p className="mt-0.5 text-mauve-dim">
          Broadcasts go out by SMS, and carrier approval for Hapnin’s number is still in progress. You have{" "}
          {audience} opted-in {audience === 1 ? "buyer" : "buyers"} ready for when it is.
        </p>
      </div>
    );
  }

  if (audience === 0) {
    return <p className="text-sm text-mauve-dim">No opted-in buyers yet. Once people buy and opt in, you can text them here.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <Textarea
        name="body"
        rows={3}
        maxLength={MAX}
        onChange={(e) => setLen(e.target.value.length)}
        placeholder="Doors at 9 — come early, the opener starts at 9:30. See you tonight!"
      />
      <div className="flex items-center justify-between text-xs text-mauve-dim">
        <span>Goes to {audience} opted-in {audience === 1 ? "buyer" : "buyers"}. “Reply STOP to opt out.” is added automatically.</span>
        <span className="tabular-nums">{len}/{MAX}</span>
      </div>
      {err.body && <p className="text-sm text-coral">{err.body}</p>}
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit disabled={len < 3} />
    </form>
  );
}
