"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createOrganizerEventAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { Card, Field, Input, Textarea, Select, buttonClass } from "@/app/components/ui";
import { FlyerUpload } from "@/app/components/FlyerUpload";

type TierRow = { key: number; name: string; price: string; qty: string; start: string; end: string };
let nextKey = 2;

function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="intent"
        value="publish"
        disabled={pending}
        className={buttonClass("primary")}
      >
        {pending ? "Saving…" : "Publish event"}
      </button>
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        className={buttonClass("secondary")}
      >
        Save as draft
      </button>
    </div>
  );
}

export function EventBuilder() {
  const [state, action] = useActionState(createOrganizerEventAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const [tiers, setTiers] = useState<TierRow[]>([
    { key: 0, name: "", price: "", qty: "", start: "", end: "" },
    { key: 1, name: "", price: "", qty: "", start: "", end: "" },
  ]);

  const setTier = (key: number, patch: Partial<TierRow>) =>
    setTiers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addTier = () => setTiers((rows) => [...rows, { key: nextKey++, name: "", price: "", qty: "", start: "", end: "" }]);
  const removeTier = (key: number) => setTiers((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));

  return (
    <form action={action} noValidate className="space-y-6">
      <Card className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event title" error={err.title}>
            <Input name="title" placeholder="Amapiano Sundays" />
          </Field>
          <Field label="Link (optional)" error={err.slug} hint="Leave blank to build it from the title.">
            <Input name="slug" placeholder="amapiano-sundays" />
          </Field>
          <Field label="Date & time (Phoenix)" error={err.starts_at}>
            <Input type="datetime-local" name="starts_at" className="[color-scheme:dark]" />
          </Field>
          <Field label="Capacity (optional)">
            <Input name="capacity" type="number" min="1" placeholder="300" />
          </Field>
          <Field label="Venue name" error={err.venue_name}>
            <Input name="venue_name" placeholder="The Van Buren" />
          </Field>
          <Field label="Venue address" error={err.venue_address}>
            <Input name="venue_address" placeholder="401 W Van Buren St" />
          </Field>
          <Field label="City" error={err.city}>
            <Input name="city" defaultValue="Phoenix" />
          </Field>
          <Field label="State" error={err.state}>
            <Input name="state" defaultValue="AZ" />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Textarea name="description" rows={3} placeholder="What’s the night about?" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Flyer (optional)</p>
        <FlyerUpload />
      </Card>

      <Card className="space-y-5">
        <p className="font-display font-semibold text-cream">Category</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Type" error={err.event_type}>
            <Select name="event_type" options={EVENT_TYPE} />
          </Field>
          <Field label="Community" error={err.community}>
            <Select name="community" options={COMMUNITY} />
          </Field>
          <Field label="Language" error={err.primary_language}>
            <Select name="primary_language" options={LANGUAGE_CODE} />
          </Field>
          <Field label="Genre" error={err.genre}>
            <Select name="genre" options={GENRE} />
          </Field>
        </div>
        <Field label="Talent (comma-separated, optional)">
          <Input name="talent" placeholder="Uncle Waffles, Major League DJz" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold text-cream">Ticket tiers</p>
          <button type="button" onClick={addTier} className="text-sm font-semibold text-gold hover:text-gold-hi">
            + Add tier
          </button>
        </div>
        {err.tiers && <p className="text-sm text-coral">{err.tiers}</p>}
        <div className="space-y-3">
          {tiers.map((t, i) => (
            <div key={t.key} className="space-y-2 rounded-xl border border-plum-hi p-3">
              <div className="grid grid-cols-[1fr_100px_90px_28px] items-center gap-2">
                <Input
                  name="tier_name"
                  value={t.name}
                  onChange={(e) => setTier(t.key, { name: e.target.value })}
                  placeholder={i === 0 ? "General Admission" : "VIP"}
                />
                <Input
                  name="tier_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={t.price}
                  onChange={(e) => setTier(t.key, { price: e.target.value })}
                  placeholder="Price"
                />
                <Input
                  name="tier_qty"
                  type="number"
                  min="0"
                  value={t.qty}
                  onChange={(e) => setTier(t.key, { qty: e.target.value })}
                  placeholder="Qty"
                />
                <button
                  type="button"
                  onClick={() => removeTier(t.key)}
                  aria-label="Remove tier"
                  className="flex h-full items-center justify-center rounded-lg text-mauve-dim transition-colors hover:text-coral"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] uppercase tracking-[0.12em] text-mauve-dim">
                  On sale from (optional)
                  <Input
                    name="tier_start"
                    type="datetime-local"
                    value={t.start}
                    onChange={(e) => setTier(t.key, { start: e.target.value })}
                    className="mt-1 [color-scheme:dark]"
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-mauve-dim">
                  Until (optional)
                  <Input
                    name="tier_end"
                    type="datetime-local"
                    value={t.end}
                    onChange={(e) => setTier(t.key, { end: e.target.value })}
                    className="mt-1 [color-scheme:dark]"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <label className="flex items-center gap-2.5 text-sm text-mauve-dim">
        <input type="checkbox" name="is_first_event" className="h-4 w-4 accent-gold" />
        This is a launch event — waive Hapnin’s fee (buyers still cover card processing).
      </label>

      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <SubmitButtons />
      <p className="text-xs text-mauve-dim/80">
        Publishing makes it live at hapnin.now/e/your-link. Drafts stay private until you publish.
      </p>
    </form>
  );
}
