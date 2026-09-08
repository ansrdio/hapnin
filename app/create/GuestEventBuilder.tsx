"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createEventGuestAction } from "./actions";
import { initialActionState } from "@/app/admin/action-state";
import { EVENT_TYPE, COMMUNITY, LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { Card, Field, Input, Textarea, Select, buttonClass } from "@/app/components/ui";
import { FlyerUpload } from "@/app/components/FlyerUpload";

type TierRow = { key: number; name: string; price: string; qty: string };
let nextKey = 2;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full sm:w-auto`}>
      {pending ? "Saving…" : "Save & continue"}
    </button>
  );
}

export function GuestEventBuilder() {
  const [state, action] = useActionState(createEventGuestAction, initialActionState);
  const err = state.fieldErrors ?? {};
  const [email, setEmail] = useState("");
  const [tiers, setTiers] = useState<TierRow[]>([
    { key: 0, name: "", price: "", qty: "" },
    { key: 1, name: "", price: "", qty: "" },
  ]);

  const setTier = (key: number, patch: Partial<TierRow>) =>
    setTiers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addTier = () => setTiers((rows) => [...rows, { key: nextKey++, name: "", price: "", qty: "" }]);
  const removeTier = (key: number) => setTiers((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));

  useEffect(() => {
    if (state.status === "success") window.location.href = `/login?next=/o&email=${encodeURIComponent(email)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={action} noValidate className="space-y-6">
      <Card className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Event title" error={err.title}>
            <Input name="title" placeholder="Amapiano Sundays" />
          </Field>
          <Field label="Date & time (Phoenix)" error={err.starts_at}>
            <Input type="datetime-local" name="starts_at" className="[color-scheme:dark]" />
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
        <p className="font-display font-semibold text-cream">Flyer</p>
        <FlyerUpload endpoint="/api/upload/flyer-public" />
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
        <Field label="Lineup (comma-separated, optional)">
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
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={t.key} className="grid grid-cols-[1fr_100px_90px_28px] items-center gap-2">
              <Input name="tier_name" value={t.name} onChange={(e) => setTier(t.key, { name: e.target.value })} placeholder={i === 0 ? "General" : "VIP"} />
              <Input name="tier_price" type="number" step="0.01" min="0" value={t.price} onChange={(e) => setTier(t.key, { price: e.target.value })} placeholder="Price" />
              <Input name="tier_qty" type="number" min="0" value={t.qty} onChange={(e) => setTier(t.key, { qty: e.target.value })} placeholder="Qty" />
              <button type="button" onClick={() => removeTier(t.key)} aria-label="Remove tier" className="flex h-full items-center justify-center rounded-lg text-mauve-dim hover:text-coral">✕</button>
            </div>
          ))}
        </div>
      </Card>

      {/* Who's hosting — the only account step */}
      <Card className="space-y-4 border-gold/30">
        <p className="font-display font-semibold text-cream">Where should we send it?</p>
        <p className="-mt-2 text-sm text-mauve-dim">
          We’ll email you a link to publish and get paid. No password. Your flyer and more settings come next.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Name or crew" error={err.host_name}>
            <Input name="host_name" placeholder="AuraCollective" />
          </Field>
          <Field label="Email" error={err.host_email}>
            <Input name="host_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </Field>
          <Field label="Mobile" error={err.host_phone}>
            <Input name="host_phone" type="tel" placeholder="(602) 555-0142" />
          </Field>
        </div>
      </Card>

      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit />
    </form>
  );
}
