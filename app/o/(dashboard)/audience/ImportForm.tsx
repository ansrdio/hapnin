"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { importContactsAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Textarea, buttonClass } from "@/app/components/ui";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={buttonClass("primary")}>
      {pending ? "Importing…" : "Import contacts"}
    </button>
  );
}

export function ImportForm() {
  const [state, action] = useActionState(importContactsAction, initialActionState);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const err = state.fieldErrors ?? {};

  // A CSV is read in the browser and dropped into the same text field, so the
  // server sees one shape whether it came from a file or a paste.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setText(await f.text());
    setFileName(f.name);
  }

  useEffect(() => {
    if (state.status === "success") {
      setText("");
      setFileName(null);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-wrap items-center gap-3 text-sm text-mauve-dim">
        <span className={buttonClass("secondary")}>Upload CSV</span>
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="sr-only" />
        {fileName ? <span className="text-cream">{fileName} loaded — review below, then import.</span> : <span>or paste below</span>}
      </label>
      <Textarea
        name="text"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"ada@example.com, Ada Okafor\nchidi@example.com\nEmeka Obi <emeka@example.com>\n\n…or the contents of an Eventbrite export"}
      />
      {err.text && <p className="text-sm text-coral">{err.text}</p>}

      <label className="flex items-start gap-3 text-sm leading-relaxed text-mauve-dim">
        <input type="checkbox" name="attest" className="mt-1 accent-gold" />
        <span>
          I have these people&rsquo;s permission to email them about my events. Every email will say it came from
          me and carry a one-click unsubscribe.
        </span>
      </label>
      {err.attest && <p className="text-sm text-coral">{err.attest}</p>}

      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit disabled={text.trim().length < 5} />
    </form>
  );
}
