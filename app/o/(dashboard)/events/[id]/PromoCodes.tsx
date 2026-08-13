"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPromoCodeAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, Select, buttonClass, money } from "@/app/components/ui";
import type { PromoCode } from "@/lib/promos";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("secondary")}>
      {pending ? "Creating…" : "Add code"}
    </button>
  );
}

function describe(p: PromoCode): string {
  return p.kind === "percent" ? `${p.value}% off` : `${money(p.value)} off`;
}

export function PromoCodes({ eventId, codes }: { eventId: string; codes: PromoCode[] }) {
  const [state, action] = useActionState(createPromoCodeAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <form action={action} noValidate className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_120px_100px_110px_auto] sm:items-end">
        <Field label="Code" error={err.code}>
          <Input name="code" placeholder="EARLYBIRD" className="uppercase" />
        </Field>
        <Field label="Type" error={err.kind}>
          <Select name="kind" options={["percent", "amount"]} placeholder="Type" />
        </Field>
        <Field label="Value" error={err.value}>
          <Input name="value" type="number" step="0.01" min="0" placeholder="10" />
        </Field>
        <Field label="Max uses (opt.)">
          <Input name="max_redemptions" type="number" min="1" placeholder="∞" />
        </Field>
        <Submit />
      </form>
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      {codes.length > 0 && (
        <ul className="divide-y divide-plum-hi border-t border-plum-hi">
          {codes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-mono font-semibold text-cream">{p.code}</p>
                <p className="text-sm text-mauve-dim">{describe(p)}</p>
              </div>
              <p className="text-sm tabular-nums text-mauve-dim">
                {p.times_redeemed}
                {p.max_redemptions != null ? `/${p.max_redemptions}` : ""} used
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
