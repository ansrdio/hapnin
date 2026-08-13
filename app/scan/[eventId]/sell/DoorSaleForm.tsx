"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { doorSellAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, buttonClass, money } from "@/app/components/ui";

type TierOption = { id: string; name: string; price_cents: number };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${buttonClass("primary")} w-full`}>
      {pending ? "Recording…" : "Record sale"}
    </button>
  );
}

export function DoorSaleForm({ eventId, tiers }: { eventId: string; tiers: TierOption[] }) {
  const [state, action] = useActionState(doorSellAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const [tierId, setTierId] = useState(tiers[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<"cash" | "card">("cash");

  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const total = tier ? tier.price_cents * qty : 0;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="tier_id" value={tierId} />
      <input type="hidden" name="quantity" value={qty} />
      <input type="hidden" name="payment" value={payment} />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Ticket</p>
        <div className="space-y-2">
          {tiers.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTierId(t.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 ${
                t.id === tierId ? "border-gold bg-gold/10 text-cream" : "border-plum-hi text-mauve-dim"
              }`}
            >
              <span className="font-display font-semibold">{t.name}</span>
              <span className="tabular-nums">{money(t.price_cents)}</span>
            </button>
          ))}
        </div>
        {err.tier_id && <p className="mt-1 text-sm text-coral">{err.tier_id}</p>}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Quantity</p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream">−</button>
          <span className="font-display text-xl tabular-nums text-cream">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream">+</button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Paid with</p>
        <div className="flex gap-2">
          {(["cash", "card"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setPayment(m)}
              className={`flex-1 rounded-xl border px-4 py-3 capitalize ${
                payment === m ? "border-gold bg-gold/10 text-cream" : "border-plum-hi text-mauve-dim"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {err.payment && <p className="mt-1 text-sm text-coral">{err.payment}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name (optional)">
          <Input name="first_name" placeholder="Walk-in" />
        </Field>
        <Field label="Phone (optional)" error={err.phone}>
          <Input name="phone" type="tel" placeholder="Text the ticket" />
        </Field>
      </div>

      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <Submit />
      <p className="text-center text-sm text-mauve-dim">Collect {money(total)} · records revenue, no card processing.</p>
    </form>
  );
}
