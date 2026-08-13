"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPromoterLinkAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, buttonClass, money } from "@/app/components/ui";
import type { PromoterLink } from "@/lib/promoters";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("secondary")}>
      {pending ? "Creating…" : "Create link"}
    </button>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="text-sm text-gold hover:text-gold-hi"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

export function PromoterLinks({ eventId, slug, links }: { eventId: string; slug: string; links: PromoterLink[] }) {
  const [state, action] = useActionState(createPromoterLinkAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const base = `https://hapnin.now/e/${slug}`;

  return (
    <div className="space-y-5">
      <form action={action} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <input type="hidden" name="event_id" value={eventId} />
        <Field label="Promoter name" error={err.name}>
          <Input name="name" placeholder="Tunde" />
        </Field>
        <Field label="Commission / order (opt.)">
          <Input name="commission" type="number" step="0.01" min="0" placeholder="2.00" />
        </Field>
        <Submit />
      </form>
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      {links.length > 0 && (
        <ul className="divide-y divide-plum-hi border-t border-plum-hi">
          {links.map((l) => {
            const owed = l.commission_cents * l.orders_count;
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-cream">{l.name}</p>
                  <p className="text-sm text-mauve-dim">
                    {`${base}?p=${l.code}`}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="font-display font-semibold tabular-nums text-cream">
                      {l.tickets_count} <span className="text-mauve-dim">sold</span>
                    </p>
                    <p className="text-sm text-mauve-dim">
                      {money(l.gross_cents)}
                      {l.commission_cents > 0 && ` · owes ${money(owed)}`}
                    </p>
                  </div>
                  <CopyLink url={`${base}?p=${l.code}`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
