"use client";

import { useState } from "react";
import { CATEGORIES, SCENE_TAGS, SCENE_GROUP_LABELS, GENRE_PROMINENT, MAX_SCENE_TAGS, type SceneGroup } from "@/lib/taxonomy";
import { LANGUAGE_CODE, GENRE } from "@/lib/enums";
import { inputClass, labelClass } from "@/app/components/ui";

// The classification block shared by every event form (organizer create,
// organizer edit, guest create, admin create). One Category, any number of
// Scene & culture tags, and two optional fields — Language, and Genre, which
// steps forward only for the categories where the sound is the point.
//
// Submits as plain form fields: `category`, repeated `scene_tags` checkboxes
// (read server-side with FormData.getAll), `primary_language`, `genre`.

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const GROUPS: SceneGroup[] = ["music", "culture", "format"];

export function ClassificationFields({
  defaults,
  errors = {},
}: {
  defaults?: { category?: string | null; scene_tags?: string[]; primary_language?: string | null; genre?: string | null };
  errors?: Record<string, string | undefined>;
}) {
  const [category, setCategory] = useState(defaults?.category ?? "");
  const [tags, setTags] = useState<string[]>(defaults?.scene_tags ?? []);
  const genreProminent = (GENRE_PROMINENT as readonly string[]).includes(category);
  const [showOptional, setShowOptional] = useState(!!(defaults?.primary_language || (defaults?.genre && !genreProminent)));

  const toggle = (id: string) =>
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < MAX_SCENE_TAGS ? [...prev, id] : prev));

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="category">Category</label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} [color-scheme:dark]`}
        >
          <option value="" disabled>What kind of event is this?</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-sm text-coral">{errors.category}</p>}
      </div>

      <div>
        <p className={labelClass}>Scene &amp; culture</p>
        <p className="-mt-0.5 mb-2.5 text-xs text-mauve-dim">Add the scenes, cultures or communities this event is built around. Optional, up to {MAX_SCENE_TAGS}.</p>
        {tags.map((t) => (
          <input key={t} type="hidden" name="scene_tags" value={t} />
        ))}
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-mauve-dim/80">{SCENE_GROUP_LABELS[g]}</p>
              <div className="flex flex-wrap gap-1.5">
                {SCENE_TAGS.filter((t) => t.group === g).map((t) => {
                  const on = tags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        on ? "border-gold bg-gold/15 text-cream" : "border-plum-hi bg-plum/40 text-mauve-dim hover:border-gold/60 hover:text-cream"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {errors.scene_tags && <p className="mt-1 text-sm text-coral">{errors.scene_tags}</p>}
      </div>

      {genreProminent ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalSelect name="genre" label="Genre" options={GENRE} defaultValue={defaults?.genre ?? ""} hint="The sound of the night." />
          <OptionalSelect name="primary_language" label="Language (optional)" options={LANGUAGE_CODE} defaultValue={defaults?.primary_language ?? ""} />
        </div>
      ) : showOptional ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionalSelect name="genre" label="Genre (optional)" options={GENRE} defaultValue={defaults?.genre ?? ""} />
          <OptionalSelect name="primary_language" label="Language (optional)" options={LANGUAGE_CODE} defaultValue={defaults?.primary_language ?? ""} />
        </div>
      ) : (
        <button type="button" onClick={() => setShowOptional(true)} className="text-sm text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-hi">
          Add language or genre (optional)
        </button>
      )}
    </div>
  );
}

function OptionalSelect({
  name,
  label,
  options,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue} className={`${inputClass} [color-scheme:dark]`}>
        <option value="">Not specified</option>
        {options.map((o) => (
          <option key={o} value={o}>{humanize(o)}</option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-mauve-dim">{hint}</p>}
    </div>
  );
}
