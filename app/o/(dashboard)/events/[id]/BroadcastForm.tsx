"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { broadcastAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Input, Textarea, buttonClass } from "@/app/components/ui";
import type { AudienceSummary, BroadcastRecord } from "@/lib/broadcasts";

const MAX = 1000;

function Submit({ disabled, total }: { disabled: boolean; total: number }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={buttonClass("primary")}>
      {pending ? "Sending…" : `Send to ${total}`}
    </button>
  );
}

function fmtWhen(ms: number): string {
  return ms
    ? new Date(ms).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

export function BroadcastForm({
  eventId,
  audience,
  smsOff = false,
  history = [],
  defaultSubject,
  defaultBody,
}: {
  eventId: string;
  audience: AudienceSummary;
  smsOff?: boolean;
  history?: BroadcastRecord[];
  // Prefill (e.g. the post-event "Thank your guests" template). Still editable.
  defaultSubject?: string;
  defaultBody?: string;
}) {
  const [state, action] = useActionState(broadcastAction, initialActionState);
  const [len, setLen] = useState(defaultBody?.length ?? 0);
  const err = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      {audience.total === 0 ? (
        <p className="text-sm text-mauve-dim">
          No opted-in buyers yet. Once people buy and tick “keep me posted,” you can message them here.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="event_id" value={eventId} />
          <Input
            name="subject"
            placeholder="Subject (optional) — e.g. Set times for Sunday"
            maxLength={120}
            defaultValue={defaultSubject}
          />
          <Textarea
            name="body"
            rows={defaultBody ? 7 : 5}
            maxLength={MAX}
            defaultValue={defaultBody}
            onChange={(e) => setLen(e.target.value.length)}
            placeholder={"Doors at 9 — come early, the opener starts at 9:30.\n\nSee you tonight!"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mauve-dim">
            <span>
              Emails <span className="text-cream">{audience.email}</span>
              {smsOff ? (
                <> · texts off until carrier approval</>
              ) : (
                <>
                  {" "}· texts <span className="text-cream">{audience.sms}</span> (first 300 characters + a link)
                </>
              )}
              . Every email carries an unsubscribe link.
            </span>
            <span className="tabular-nums">
              {len}/{MAX}
            </span>
          </div>
          {err.body && <p className="text-sm text-coral">{err.body}</p>}
          {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
          {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
          <Submit disabled={len < 3} total={audience.total} />
        </form>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mauve-dim">Sent</p>
          <ul className="divide-y divide-plum-hi rounded-xl border border-plum-hi">
            {history.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-cream">{b.subject}</p>
                  <p className="text-xs text-mauve-dim">{fmtWhen(b.created_at)}</p>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-mauve-dim">{b.body}</p>
                <p className="mt-1 text-xs text-mauve-dim">
                  emailed {b.email_sent}
                  {b.sms_sent > 0 && <> · texted {b.sms_sent}</>}
                  {b.sms_skipped > 0 && <> · {b.sms_skipped} text{b.sms_skipped === 1 ? "" : "s"} skipped (texting off)</>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
