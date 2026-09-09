"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { editEventAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { REFUND_POLICIES, REFUND_POLICY_SHORT } from "@/lib/refund-policy";
import { Card, Field, Input, Textarea, Select, inputClass, buttonClass } from "@/app/components/ui";

type EventData = {
  id: string;
  title: string;
  description: string;
  venue_name: string;
  venue_address: string;
  venue_zip: string;
  city: string;
  state: string;
  starts_at: number;
  capacity: number | null;
  refund_policy: string;
  event_type: string;
  community: string;
  primary_language: string;
  genre: string;
  talent: string[];
};
type Tier = { id: string; name: string; price_cents: number; quantity_total: number; quantity_sold: number; is_active: boolean };
type Row = { key: number; id: string; name: string; price: string; qty: string; active: boolean; sold: number };

let nextKey = 1;

// Phoenix (UTC-7) wall time as a datetime-local value.
function toLocalInput(ms: number): string {
  return new Date(ms - 7 * 3600 * 1000).toISOString().slice(0, 16);
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditEventForm({ event, tiers }: { event: EventData; tiers: Tier[] }) {
  const [state, action] = useActionState(editEventAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const [rows, setRows] = useState<Row[]>(
    tiers.map((t) => ({
      key: nextKey++,
      id: t.id,
      name: t.name,
      price: (t.price_cents / 100).toString(),
      qty: t.quantity_total.toString(),
      active: t.is_active,
      sold: t.quantity_sold,
    }))
  );

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { key: nextKey++, id: "", name: "", price: "", qty: "", active: true, sold: 0 }]);
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="event_id" value={event.id} />

      <Card className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event title" error={err.title}>
            <Input name="title" defaultValue={event.title} />
          </Field>
          <Field label="Date & time (Phoenix)" error={err.starts_at}>
            <Input type="datetime-local" name="starts_at" defaultValue={toLocalInput(event.starts_at)} className="[color-scheme:dark]" />
          </Field>
          <Field label="Venue name" error={err.venue_name}>
            <Input name="venue_name" defaultValue={event.venue_name} />
          </Field>
          <Field label="Venue address" error={err.venue_address}>
            <Input name="venue_address" defaultValue={event.venue_address} />
          </Field>
          <Field label="City" error={err.city}>
            <Input name="city" defaultValue={event.city} />
          </Field>
          <Field label="State" error={err.state}>
            <Input name="state" defaultValue={event.state} />
          </Field>
          <Field label="ZIP (optional)">
            <Input name="venue_zip" inputMode="numeric" defaultValue={event.venue_zip} placeholder="85004" />
          </Field>
          <Field label="Capacity (optional)">
            <Input name="capacity" type="number" min="1" defaultValue={event.capacity ?? ""} />
          </Field>
          <Field label="Refund policy" hint="Shown to buyers before they pay.">
            <select name="refund_policy" defaultValue={event.refund_policy || "none"} className={`${inputClass} [color-scheme:dark]`}>
              {REFUND_POLICIES.map((p) => (
                <option key={p} value={p}>{REFUND_POLICY_SHORT[p]}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description (optional)">
          <Textarea name="description" rows={3} defaultValue={event.description} />
        </Field>
      </Card>

      <Card className="space-y-5">
        <p className="font-display font-semibold text-cream">Category</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Type" error={err.event_type}>
            <Select name="event_type" options={EVENT_TYPE} defaultValue={event.event_type} />
          </Field>
          <Field label="Community" error={err.community}>
            <Select name="community" options={COMMUNITY} defaultValue={event.community} />
          </Field>
          <Field label="Language" error={err.primary_language}>
            <Select name="primary_language" options={LANGUAGE_CODE} defaultValue={event.primary_language} />
          </Field>
          <Field label="Genre" error={err.genre}>
            <Select name="genre" options={GENRE} defaultValue={event.genre} />
          </Field>
        </div>
        <Field label="Lineup (comma-separated, optional)">
          <Input name="talent" defaultValue={event.talent.join(", ")} placeholder="Uncle Waffles, Major League DJz" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold text-cream">Ticket tiers</p>
          <button type="button" onClick={addRow} className="text-sm font-semibold text-gold hover:text-gold-hi">+ Add tier</button>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="space-y-2 rounded-xl border border-plum-hi p-3">
              <input type="hidden" name="tier_id" value={r.id} />
              <input type="hidden" name="tier_active" value={r.active ? "1" : "0"} />
              <div className="grid grid-cols-[1fr_100px_90px] gap-2">
                <Input name="tier_name" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} placeholder="General" />
                <Input name="tier_price" type="number" step="0.01" min="0" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value })} placeholder="Price" />
                <Input name="tier_qty" type="number" min={r.sold} value={r.qty} onChange={(e) => setRow(r.key, { qty: e.target.value })} placeholder="Qty" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-mauve-dim">{r.id ? `${r.sold} sold` : "New tier"}</span>
                <div className="flex items-center gap-3">
                  {r.id ? (
                    <button type="button" onClick={() => setRow(r.key, { active: !r.active })} className={r.active ? "text-emerald" : "text-mauve-dim"}>
                      {r.active ? "On sale" : "Off sale"} · tap to toggle
                    </button>
                  ) : (
                    <button type="button" onClick={() => removeRow(r.key)} className="text-mauve-dim hover:text-coral">Remove</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-mauve-dim/80">Sold tiers can’t drop below what’s sold, and can’t be deleted — take them off sale instead.</p>
      </Card>

      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <div className="flex items-center gap-4">
        <Save />
        <a href={`/o/events/${event.id}`} className="text-sm text-mauve-dim hover:text-cream">Back to event</a>
      </div>
    </form>
  );
}
