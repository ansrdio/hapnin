"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { transferAction } from "./actions";
import { initialActionState } from "@/app/admin/action-state";

const field = "w-full rounded-xl border border-plum-hi bg-plum px-4 py-3 text-cream placeholder:text-mauve-dim/60 focus:border-gold";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded-xl bg-gold px-6 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
    >
      {pending ? "Sending…" : `Send ${count} ${count > 1 ? "tickets" : "ticket"}`}
    </button>
  );
}

export function TransferForm({ orderId, transferable }: { orderId: string; transferable: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(transferAction, initialActionState);
  const [count, setCount] = useState(1);
  const err = state.fieldErrors ?? {};

  if (transferable < 1) return null;

  if (state.status === "success") {
    return <p className="mt-8 rounded-2xl border border-emerald/40 bg-emerald/10 p-4 text-center text-sm text-emerald">{state.message}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-8 w-full rounded-xl border border-plum-hi px-6 py-3.5 font-display font-semibold text-cream transition-colors hover:bg-plum"
      >
        Send a ticket to someone
      </button>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-3 rounded-2xl border border-plum-hi bg-plum/40 p-5">
      <p className="font-display font-semibold text-cream">Send tickets</p>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="count" value={count} />

      {transferable > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-mauve-dim">How many?</span>
          <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} className="h-9 w-9 rounded-lg border border-plum-hi text-cream">−</button>
          <span className="tabular-nums text-cream">{count}</span>
          <button type="button" onClick={() => setCount((c) => Math.min(transferable, c + 1))} className="h-9 w-9 rounded-lg border border-plum-hi text-cream">+</button>
        </div>
      )}

      <input name="first_name" className={field} placeholder="Their name (optional)" />
      <input name="phone" type="tel" className={field} placeholder="Their mobile number" />
      {err.phone && <p className="text-sm text-coral">{err.phone}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <Submit count={count} />
      <p className="text-center text-xs text-mauve-dim">They get their own ticket; yours stops working once sent.</p>
    </form>
  );
}
