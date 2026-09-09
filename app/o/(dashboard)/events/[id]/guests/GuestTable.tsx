"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { checkInOrderAction, resendTicketAction, refundOrderAction } from "@/app/o/actions";
import { Card, Input, money } from "@/app/components/ui";
import type { GuestRow } from "@/lib/attendees";

function RefundSubmit({ amount }: { amount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-coral px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-coral/90 disabled:opacity-60"
    >
      {pending ? "Refunding…" : `Yes, refund ${money(amount)}`}
    </button>
  );
}

export function GuestTable({ eventId, guests }: { eventId: string; guests: GuestRow[] }) {
  const [q, setQ] = useState("");
  // Which order (if any) is showing its inline refund confirmation. Replaces
  // the browser's confirm() dialog so the organizer sees exactly what happens
  // (voided ticket, 5–10 day return, buyer emailed) before committing.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return guests;
    return guests.filter((g) => g.name.toLowerCase().includes(needle) || g.phone.includes(needle));
  }, [q, guests]);

  return (
    <div className="space-y-4">
      <Input placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card className="p-0">
        <ul className="divide-y divide-plum-hi">
          {filtered.map((g) => {
            const allIn = g.checkedIn >= g.quantity;
            const refunded = g.status === "refunded";
            const confirming = g.refundable && confirmId === g.orderId;
            return (
              <li key={g.orderId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-cream">
                    <span className="truncate">{g.name}</span>
                    {g.channel === "comp" && <span className="text-xs uppercase tracking-wide text-gold">comp</span>}
                    {refunded && <span className="text-xs uppercase tracking-wide text-coral">refunded</span>}
                  </p>
                  <p className="text-sm text-mauve-dim">
                    {g.quantity}× {g.tierName} · {g.channel === "comp" ? "Free" : money(g.totalCents)} ·{" "}
                    {g.checkedIn}/{g.quantity} in
                  </p>
                </div>

                {!refunded && !confirming && (
                  <div className="flex items-center gap-2">
                    {!allIn && (
                      <form action={checkInOrderAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="order_id" value={g.orderId} />
                        <button className="rounded-lg border border-emerald/40 px-3 py-1.5 text-sm font-semibold text-emerald hover:bg-emerald/10">
                          Check in {g.quantity > 1 ? `(${g.quantity - g.checkedIn})` : ""}
                        </button>
                      </form>
                    )}
                    <form action={resendTicketAction}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="order_id" value={g.orderId} />
                      <button className="rounded-lg border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim hover:text-cream">
                        Resend
                      </button>
                    </form>
                    {g.refundable && (
                      <button
                        type="button"
                        onClick={() => setConfirmId(g.orderId)}
                        className="rounded-lg border border-coral/40 px-3 py-1.5 text-sm text-coral hover:bg-coral/10"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                )}

                {confirming && (
                  <div className="basis-full rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
                    <p className="text-sm text-cream">
                      Refund <span className="font-semibold">{money(g.totalCents)}</span> to {g.name}?
                    </p>
                    <p className="mt-0.5 text-xs text-mauve-dim">
                      Their ticket is voided and the money returns to their card in 5–10 business days. We&rsquo;ll
                      email them. This can&rsquo;t be undone.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <form action={refundOrderAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="order_id" value={g.orderId} />
                        <RefundSubmit amount={g.totalCents} />
                      </form>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim hover:text-cream"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-5 py-6 text-center text-mauve-dim">No matches.</li>}
        </ul>
      </Card>
    </div>
  );
}
