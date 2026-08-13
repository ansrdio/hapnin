"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { issueCompAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, buttonClass } from "@/app/components/ui";

type TierOption = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("secondary")}>
      {pending ? "Issuing…" : "Issue comp"}
    </button>
  );
}

export function CompForm({ eventId, tiers }: { eventId: string; tiers: TierOption[] }) {
  const [state, action] = useActionState(issueCompAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-2">
          <Field label="Tier" error={err.tier_id}>
            <select name="tier_id" defaultValue={tiers[0]?.id ?? ""} className="w-full rounded-xl border border-plum-hi bg-ink/50 px-3.5 py-2.5 text-cream [color-scheme:dark] outline-none focus:border-gold">
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Qty">
          <Input name="quantity" type="number" min="1" max="20" defaultValue="1" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" error={err.first_name}>
          <Input name="first_name" placeholder="Ada" />
        </Field>
        <Field label="Last name">
          <Input name="last_name" placeholder="Okafor" />
        </Field>
        <Field label="Mobile" error={err.phone}>
          <Input name="phone" type="tel" placeholder="(602) 555-0142" />
        </Field>
        <Field label="Email (optional)">
          <Input name="email" type="email" placeholder="ada@example.com" />
        </Field>
      </div>

      <Field label="Note (optional)">
        <Input name="note" placeholder="Artist +1" />
      </Field>

      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <Submit />
    </form>
  );
}
