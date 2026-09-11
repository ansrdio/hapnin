"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createOrganizerEventAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { REFUND_POLICIES, REFUND_POLICY_SHORT } from "@/lib/refund-policy";
import { Card, Field, Input, Textarea, Select, inputClass, buttonClass } from "@/app/components/ui";
import { FlyerUpload } from "@/app/components/FlyerUpload";
import { EVENT_TEMPLATES, findTemplate, type EventTemplate } from "@/lib/templates";

type TierRow = { key: number; name: string; price: string; qty: string; start: string; end: string };
let nextKey = 100;

const blankRows = (): TierRow[] => [
  { key: nextKey++, name: "", price: "", qty: "", start: "", end: "" },
  { key: nextKey++, name: "", price: "", qty: "", start: "", end: "" },
];
const rowsFrom = (t: EventTemplate): TierRow[] =>
  t.tiers.map((x) => ({ key: nextKey++, name: x.name, price: String(x.price), qty: String(x.qty), start: "", end: "" }));

// Start from a template or from scratch. Picking one prefills the form (the
// form remounts via `key` so uncontrolled fields take the new defaults);
// nothing is saved until Publish / Save as draft.
function TemplatePicker({ current, onPick }: { current: EventTemplate | null; onPick: (t: EventTemplate | null) => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-cream">Start from a template</p>
          <p className="mt-0.5 text-sm text-mauve-dim">Tiers, pricing and the blurb filled in for the kind of night it is. Change anything.</p>
        </div>
        {current && (
          <button type="button" onClick={() => onPick(null)} className="shrink-0 text-sm text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream">
            Start blank
          </button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EVENT_TEMPLATES.map((t) => {
          const on = current?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(on ? null : t)}
              aria-pressed={on}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                on ? "border-gold bg-gold/10" : "border-plum-hi bg-plum/30 hover:border-gold/60"
              }`}
            >
              <span className="text-xl" aria-hidden="true">{t.emoji}</span>
              <span className="mt-1 block font-display text-sm font-semibold text-cream">{t.name}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-mauve-dim">{t.blurb}</span>
            </button>
          );
        })}
      </div>
      {current?.tip && <p className="mt-3 text-sm text-gold">{current.tip}</p>}
    </Card>
  );
}

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

export function EventBuilder({ initialTemplateId = null }: { initialTemplateId?: string | null }) {
  const [state, action] = useActionState(createOrganizerEventAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const [tpl, setTpl] = useState<EventTemplate | null>(() => findTemplate(initialTemplateId));
  const [formKey, setFormKey] = useState(0);
  const [tiers, setTiers] = useState<TierRow[]>(() => (tpl ? rowsFrom(tpl) : blankRows()));

  const pickTemplate = (t: EventTemplate | null) => {
    setTpl(t);
    setTiers(t ? rowsFrom(t) : blankRows());
    setFormKey((k) => k + 1);
  };

  const setTier = (key: number, patch: Partial<TierRow>) =>
    setTiers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addTier = () => setTiers((rows) => [...rows, { key: nextKey++, name: "", price: "", qty: "", start: "", end: "" }]);
  const removeTier = (key: number) => setTiers((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));

  return (
    <form key={formKey} action={action} noValidate className="space-y-6">
      <TemplatePicker current={tpl} onPick={pickTemplate} />

      <Card className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event title" error={err.title}>
            <Input name="title" placeholder="Amapiano Sundays" defaultValue={tpl?.title} />
          </Field>
          <Field label="Link (optional)" error={err.slug} hint="Leave blank to build it from the title.">
            <Input name="slug" placeholder="amapiano-sundays" />
          </Field>
          <Field label="Date & time (Phoenix)" error={err.starts_at}>
            <Input type="datetime-local" name="starts_at" className="[color-scheme:dark]" />
          </Field>
          <Field label="Capacity (optional)">
            <Input name="capacity" type="number" min="1" placeholder="300" defaultValue={tpl?.capacity ?? undefined} />
          </Field>
          <Field label="Refund policy" hint="Shown to buyers before they pay.">
            <select name="refund_policy" defaultValue={tpl?.refund_policy ?? "none"} className={`${inputClass} [color-scheme:dark]`}>
              {REFUND_POLICIES.map((p) => (
                <option key={p} value={p}>{REFUND_POLICY_SHORT[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Bring-a-friend discount ($, optional)" hint="Buyers get a share link; friends who use it get this much off.">
            <Input name="referral_off" type="number" min="0" max="50" step="1" placeholder="5" defaultValue={tpl && tpl.referral_off > 0 ? tpl.referral_off : undefined} />
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
          <Field label="ZIP (optional)">
            <Input name="venue_zip" inputMode="numeric" placeholder="85004" />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Textarea name="description" rows={3} placeholder="What’s the night about?" defaultValue={tpl?.description} />
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
            <Select name="event_type" options={EVENT_TYPE} defaultValue={tpl?.event_type} />
          </Field>
          <Field label="Community" error={err.community}>
            <Select name="community" options={COMMUNITY} defaultValue={tpl?.community} />
          </Field>
          <Field label="Language" error={err.primary_language}>
            <Select name="primary_language" options={LANGUAGE_CODE} defaultValue={tpl?.primary_language} />
          </Field>
          <Field label="Genre" error={err.genre}>
            <Select name="genre" options={GENRE} defaultValue={tpl?.genre} />
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
                  placeholder="Price · 0 = free"
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

      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <SubmitButtons />
      <p className="text-xs text-mauve-dim/80">
        Publishing makes it live at hapnin.now/e/your-link. Drafts stay private until you publish.
      </p>
    </form>
  );
}
