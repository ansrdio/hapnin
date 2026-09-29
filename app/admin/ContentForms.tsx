"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, Field, Input, Textarea, inputClass, buttonClass } from "@/app/components/ui";
import { PLACE_CATEGORIES, SCENE_TAGS, SCENE_GROUP_LABELS, type SceneGroup } from "@/lib/taxonomy";
import { LANGUAGE_CODE } from "@/lib/enums";
import { initialActionState } from "./action-state";
import { ImageField } from "./ImageField";
import { createPlaceDraftAction, updatePlaceAction, createStoryDraftAction, updateStoryAction, linkEventToPlaceAction } from "./content-actions";
import type { PlaceRecord } from "@/lib/places";
import type { StoryRecord } from "@/lib/stories";

// Internal operating forms for Places and Stories. Plain on purpose.

const GROUPS: SceneGroup[] = ["culture", "music", "format"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Save({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Status({ state }: { state: { status: string; message?: string; fieldErrors?: Record<string, string> } }) {
  if (state.status === "success") return <p className="text-sm text-emerald" role="status">{state.message ?? "Saved."}</p>;
  if (state.status === "error") {
    const n = Object.keys(state.fieldErrors ?? {}).length;
    return <p className="text-sm text-coral" role="alert">{state.message ?? `Not saved — fix ${n} field${n === 1 ? "" : "s"} above.`}</p>;
  }
  return null;
}

function TagPicker({ selected = [], custom = [], error }: { selected?: string[]; custom?: string[]; error?: string }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{SCENE_GROUP_LABELS[g]}</legend>
          <div className="flex flex-wrap gap-2">
            {SCENE_TAGS.filter((t) => t.group === g).map((t) => (
              <label key={t.id} className="inline-flex items-center gap-2 rounded-full border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim has-[:checked]:border-gold has-[:checked]:text-cream">
                <input type="checkbox" name="scene_tags" value={t.id} defaultChecked={selected.includes(t.id)} className="accent-gold" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Field label="Your own tags (comma-separated, up to 3)" error={error}>
        <Input name="custom_tags" defaultValue={custom.join(", ")} placeholder="e.g. Lagos street food, Suya" />
      </Field>
    </div>
  );
}

// ── Places ──────────────────────────────────────────────────────────────────

export function NewPlaceForm() {
  const [state, action] = useActionState(createPlaceDraftAction, initialActionState);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">New place (starts as a draft)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={err.name}><Input name="name" /></Field>
          <Field label="Category" error={err.category}>
            <select name="category" defaultValue="" className={`${inputClass} [color-scheme:dark]`}>
              <option value="" disabled>Pick one</option>
              {PLACE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="City" error={err.city}><Input name="city" defaultValue="Phoenix" /></Field>
          <Field label="State" error={err.state}><Input name="state" defaultValue="AZ" /></Field>
        </div>
        <div className="flex items-center gap-4"><Save label="Create draft" /><Status state={state} /></div>
      </Card>
    </form>
  );
}

export function PlaceForm({ place }: { place: PlaceRecord }) {
  const [state, action] = useActionState(updatePlaceAction, initialActionState);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="id" value={place.id} />
      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Basics</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={err.name}><Input name="name" defaultValue={place.name} /></Field>
          <Field label="Link (hapnin.now/places/…)" error={err.slug}><Input name="slug" defaultValue={place.slug} /></Field>
          <Field label="Category" error={err.category}>
            <select name="category" defaultValue={place.category} className={`${inputClass} [color-scheme:dark]`}>
              {PLACE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Owner / founder line (optional)" hint="Shown under About, e.g. “Founded by … in 2019”." error={err.owner_display}><Input name="owner_display" defaultValue={place.owner_display ?? ""} /></Field>
        </div>
        <Field label="Short description (one or two lines, ≤200)" error={err.short_description}><Input name="short_description" defaultValue={place.short_description ?? ""} /></Field>
        <Field label="About" error={err.about}><Textarea name="about" rows={6} defaultValue={place.about ?? ""} /></Field>
        <Field label="What you’ll find here (one per line — “Name — details”)" error={err.offerings}>
          <Textarea name="offerings" rows={4} defaultValue={place.offerings.map((o) => (o.details ? `${o.name} — ${o.details}` : o.name)).join("\n")} />
        </Field>
        <Field label="Cultural context (optional)" error={err.culture_note}><Textarea name="culture_note" rows={3} defaultValue={place.culture_note ?? ""} /></Field>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Cultural associations</p>
        <TagPicker selected={place.scene_tags} custom={place.custom_tags} error={err.custom_tags} />
        <fieldset>
          <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Languages (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_CODE.map((l) => (
              <label key={l} className="inline-flex items-center gap-2 rounded-full border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim has-[:checked]:border-gold has-[:checked]:text-cream">
                <input type="checkbox" name="languages" value={l} defaultChecked={place.languages.includes(l)} className="accent-gold" />
                {cap(l)}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Location &amp; links</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Street address (optional — enables the map and Directions)" error={err.address}><Input name="address" defaultValue={place.address ?? ""} /></Field>
          <Field label="ZIP" error={err.zip}><Input name="zip" defaultValue={place.zip ?? ""} inputMode="numeric" /></Field>
          <Field label="City" error={err.city}><Input name="city" defaultValue={place.city} /></Field>
          <Field label="State" error={err.state}><Input name="state" defaultValue={place.state} /></Field>
          <Field label="Website" error={err.website}><Input name="website" defaultValue={place.website ?? ""} placeholder="https://…" /></Field>
          <Field label="Instagram handle" error={err.instagram}><Input name="instagram" defaultValue={place.instagram ?? ""} placeholder="handle" /></Field>
          <Field label="Phone (optional)" error={err.phone}><Input name="phone" defaultValue={place.phone ?? ""} type="tel" /></Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Images</p>
        <Field label="Hero image" error={err.hero_image_url}><ImageField name="hero_image_url" kind="places" initial={place.hero_image_url ? [place.hero_image_url] : []} /></Field>
        <Field label="Hero image description (alt text)" hint="What the photo shows, for people using screen readers." error={err.hero_image_alt}><Input name="hero_image_alt" defaultValue={place.hero_image_alt ?? ""} /></Field>
        <Field label="Gallery (up to 12)" error={err.gallery}><ImageField name="gallery" kind="places" initial={place.gallery} multiple /></Field>
      </Card>

      <Card className="space-y-3">
        <label className="flex items-center gap-3 text-sm text-cream"><input type="checkbox" name="featured" defaultChecked={place.featured} className="accent-gold" /> Featured (listed first, eligible for the homepage)</label>
        <label className="flex items-center gap-3 text-sm text-cream"><input type="checkbox" name="claimed" defaultChecked={place.claimed} className="accent-gold" /> The business has confirmed this profile</label>
      </Card>

      <div className="flex items-center gap-4"><Save /><Status state={state} /></div>
    </form>
  );
}

export function LinkEventForm({ placeId }: { placeId: string }) {
  const [state, action] = useActionState(linkEventToPlaceAction, initialActionState);
  return (
    <form action={action} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="place_id" value={placeId} />
      <div className="flex-1">
        <Input name="event_ref" placeholder="Event link, e.g. https://www.hapnin.now/e/taste-of-nigeria" aria-label="Event link or slug" />
        {state.fieldErrors?.event_ref && <p className="mt-1 text-sm text-coral">{state.fieldErrors.event_ref}</p>}
        {state.status === "success" && <p className="mt-1 text-sm text-emerald">{state.message}</p>}
      </div>
      <Save label="Link event" />
    </form>
  );
}

// ── Stories ─────────────────────────────────────────────────────────────────

export function NewStoryForm() {
  const [state, action] = useActionState(createStoryDraftAction, initialActionState);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">New story (starts as a draft)</p>
        <Field label="Title" error={err.title}><Input name="title" placeholder="Inside the Culture — …" /></Field>
        <div className="flex items-center gap-4"><Save label="Create draft" /><Status state={state} /></div>
      </Card>
    </form>
  );
}

export function StoryForm({ story, places, eventSlugs }: { story: StoryRecord; places: { id: string; name: string; status: string }[]; eventSlugs: string[] }) {
  const [state, action] = useActionState(updateStoryAction, initialActionState);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="id" value={story.id} />
      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Story</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={err.title}><Input name="title" defaultValue={story.title} /></Field>
          <Field label="Link (hapnin.now/stories/…)" error={err.slug}><Input name="slug" defaultValue={story.slug} /></Field>
        </div>
        <Field label="Subtitle / excerpt (≤240)" error={err.subtitle}><Input name="subtitle" defaultValue={story.subtitle ?? ""} /></Field>
        <Field label="Video link (YouTube or Vimeo)" hint="Loads only when someone taps play. Upload captions on YouTube/Vimeo." error={err.video_url}><Input name="video_url" defaultValue={story.video_url ?? ""} placeholder="https://youtu.be/…" /></Field>
        <Field label="Body" hint="Blank line between paragraphs. Start a line with “## ” for a section heading." error={err.body}><Textarea name="body" rows={12} defaultValue={story.body ?? ""} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author (optional)" error={err.author}><Input name="author" defaultValue={story.author ?? ""} /></Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Images</p>
        <Field label="Hero / thumbnail image" hint="Used as the video poster and share image. Without one, the YouTube thumbnail is used." error={err.hero_image_url}><ImageField name="hero_image_url" kind="stories" initial={story.hero_image_url ? [story.hero_image_url] : []} /></Field>
        <Field label="Image description (alt text)" error={err.hero_image_alt}><Input name="hero_image_alt" defaultValue={story.hero_image_alt ?? ""} /></Field>
      </Card>

      <Card className="space-y-4">
        <p className="font-display font-semibold text-cream">Relationships</p>
        <fieldset>
          <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">About these places</legend>
          {places.length === 0 ? (
            <p className="text-sm text-mauve-dim">No places yet — create the place first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {places.map((p) => (
                <label key={p.id} className="inline-flex items-center gap-2 rounded-full border border-plum-hi px-3 py-1.5 text-sm text-mauve-dim has-[:checked]:border-gold has-[:checked]:text-cream">
                  <input type="checkbox" name="place_ids" value={p.id} defaultChecked={story.place_ids.includes(p.id)} className="accent-gold" />
                  {p.name}{p.status !== "published" ? " (draft)" : ""}
                </label>
              ))}
            </div>
          )}
          {err.place_ids && <p className="mt-1 text-sm text-coral">{err.place_ids}</p>}
        </fieldset>
        <Field label="Related events (one link per line)" hint="Only on-sale events show on the story page." error={err.event_refs}>
          <Textarea name="event_refs" rows={3} defaultValue={eventSlugs.map((s) => `/e/${s}`).join("\n")} />
        </Field>
        <TagPicker selected={story.scene_tags} custom={story.custom_tags} error={err.custom_tags} />
      </Card>

      <Card>
        <label className="flex items-center gap-3 text-sm text-cream"><input type="checkbox" name="featured" defaultChecked={story.featured} className="accent-gold" /> Featured (listed first, eligible for the homepage)</label>
      </Card>

      <div className="flex items-center gap-4"><Save /><Status state={state} /></div>
    </form>
  );
}
