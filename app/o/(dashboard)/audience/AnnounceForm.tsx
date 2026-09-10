"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { announceEventAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Input, Textarea, buttonClass } from "@/app/components/ui";

type AnnounceableEvent = { id: string; title: string; whenText: string; url: string };

const MAX = 2000;

function Submit({ disabled, total }: { disabled: boolean; total: number }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={buttonClass("primary")}>
      {pending ? "Sending…" : `Send to ${total.toLocaleString()}`}
    </button>
  );
}

function templateFor(e: AnnounceableEvent) {
  return {
    subject: `${e.title} — tickets are live`,
    body: `We’re back: ${e.title}.\n${e.whenText}.\n\nGrab your tickets before they’re gone: ${e.url}\n\nSee you there.`,
  };
}

export function AnnounceForm({ events, audienceSize }: { events: AnnounceableEvent[]; audienceSize: number }) {
  const [state, action] = useActionState(announceEventAction, initialActionState);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const first = templateFor(events[0]);
  const [subject, setSubject] = useState(first.subject);
  const [body, setBody] = useState(first.body);
  const err = state.fieldErrors ?? {};

  function pick(id: string) {
    setEventId(id);
    const e = events.find((x) => x.id === id);
    if (e) {
      const t = templateFor(e);
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  return (
    <form action={action} className="space-y-3">
      {events.length > 1 ? (
        <select
          name="event_id"
          value={eventId}
          onChange={(e) => pick(e.target.value)}
          className="w-full rounded-xl border border-plum-hi bg-ink/50 px-3.5 py-2.5 text-cream [color-scheme:dark] outline-none focus:border-gold"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} — {e.whenText}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="event_id" value={eventId} />
      )}
      <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Subject" />
      {err.subject && <p className="text-sm text-coral">{err.subject}</p>}
      <Textarea name="body" rows={6} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} />
      {err.body && <p className="text-sm text-coral">{err.body}</p>}
      <p className="text-xs text-mauve-dim">
        Emails <span className="text-cream">{audienceSize.toLocaleString()}</span> people from your name, with the
        event flyer. Every copy carries an unsubscribe link and says why they&rsquo;re getting it.
        {audienceSize === 0 && " Import contacts first."}
      </p>
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit disabled={audienceSize === 0 || body.trim().length < 3 || !subject.trim()} total={audienceSize} />
    </form>
  );
}
