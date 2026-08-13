"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTableAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, buttonClass, money } from "@/app/components/ui";
import type { Tier } from "@/lib/events";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("secondary")}>
      {pending ? "Adding…" : "Add table"}
    </button>
  );
}

export function TableManager({ eventId, tables }: { eventId: string; tables: Tier[] }) {
  const [state, action] = useActionState(createTableAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <form action={action} noValidate className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_90px_110px_auto] sm:items-end">
        <Field label="Table name" error={err.name}>
          <Input name="name" placeholder="VIP Booth 1" />
        </Field>
        <Field label="Seats" error={err.seats}>
          <Input name="seats" type="number" min="1" placeholder="8" />
        </Field>
        <Field label="Price" error={err.price}>
          <Input name="price" type="number" step="0.01" min="0" placeholder="500" />
        </Field>
        <Submit />
      </form>
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      {tables.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {tables.map((t) => {
            const sold = t.quantity_sold >= t.quantity_total;
            return (
              <div
                key={t.id}
                className={`flex w-28 flex-col items-center justify-center rounded-2xl border p-3 text-center ${
                  sold ? "border-plum-hi/60 bg-plum/20 opacity-55" : "border-gold/50 bg-gold/5"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-current text-xs text-gold">
                  {t.seats}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-cream">{t.name}</p>
                <p className="text-xs text-mauve-dim">{money(t.price_cents)}</p>
                <p className={`text-[11px] ${sold ? "text-coral" : "text-emerald"}`}>{sold ? "Sold" : "Open"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
