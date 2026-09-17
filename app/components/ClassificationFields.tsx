"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  SCENE_TAGS,
  SCENE_GROUP_LABELS,
  MAX_SCENE_TAGS,
  CUSTOM_TAG_MAX,
  normalizeCustomTag,
  canonicalFor,
  sceneTagLabel,
  tagKey,
  type SceneGroup,
} from "@/lib/taxonomy";
import { LANGUAGE_CODE } from "@/lib/enums";
import { inputClass, labelClass } from "@/app/components/ui";

// The classification block shared by every event form (organizer create,
// organizer edit, guest create, admin create):
//
//   Category         one canonical pick
//   Scene & culture  one search box — filters Hapnin's canonical tags, and
//                    offers "Add “X” as your own tag" for anything that isn't one
//   Language         optional
//
// Selected tags sit above the box as chips: canonical filled, custom outlined.
// Submits as plain fields: `category`, repeated `scene_tags`, repeated
// `custom_tags`, `primary_language` (server reads the lists with getAll).

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const GROUPS: SceneGroup[] = ["music", "culture", "format"];

export function ClassificationFields({
  defaults,
  errors = {},
}: {
  defaults?: { category?: string | null; scene_tags?: string[]; custom_tags?: string[]; primary_language?: string | null };
  errors?: Record<string, string | undefined>;
}) {
  const [category, setCategory] = useState(defaults?.category ?? "");
  const [tags, setTags] = useState<string[]>(defaults?.scene_tags ?? []);
  const [custom, setCustom] = useState<string[]>(defaults?.custom_tags ?? []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Close the list when focus leaves the whole control.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const needle = tagKey(q);
  const matches = useMemo(
    () => SCENE_TAGS.filter((t) => !tags.includes(t.id) && (!needle || tagKey(t.label).includes(needle) || tagKey(t.id).includes(needle))),
    [needle, tags]
  );
  const exact = q.trim() ? canonicalFor(q) : null;
  const customCheck = q.trim() && !exact ? normalizeCustomTag(q) : null;
  const customDup = customCheck?.ok ? custom.some((c) => tagKey(c) === tagKey(customCheck.value)) : false;
  const canOfferCustom = !!customCheck?.ok && !customDup && custom.length < CUSTOM_TAG_MAX;

  const addTag = (id: string) => {
    if (tags.length >= MAX_SCENE_TAGS) return setNote(`Up to ${MAX_SCENE_TAGS} Hapnin tags.`);
    setTags((p) => (p.includes(id) ? p : [...p, id]));
    setQ("");
    setNote(null);
  };
  const addCustom = () => {
    if (!customCheck?.ok) return;
    if (customDup) return setNote("You already added that one.");
    if (custom.length >= CUSTOM_TAG_MAX) return setNote(`Up to ${CUSTOM_TAG_MAX} of your own tags.`);
    setCustom((p) => [...p, customCheck.value]);
    setQ("");
    setNote(null);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // never submit the whole form from the tag box
      if (exact && !tags.includes(exact)) addTag(exact);
      else if (needle && matches.length > 0 && (tagKey(matches[0].label).startsWith(needle) || matches.length === 1)) addTag(matches[0].id);
      else if (canOfferCustom) addCustom();
    } else if (e.key === "Backspace" && !q) {
      if (custom.length) setCustom((p) => p.slice(0, -1));
      else if (tags.length) setTags((p) => p.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const chip = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm";
  const listRows = needle ? matches : SCENE_TAGS.filter((t) => !tags.includes(t.id));

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="category">Category</label>
        <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} [color-scheme:dark]`}>
          <option value="" disabled>What kind of event is this?</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-sm text-coral">{errors.category}</p>}
      </div>

      <div ref={box}>
        <label className={labelClass} htmlFor="scene-search">Scene &amp; culture</label>
        <p className="-mt-0.5 mb-2 text-xs text-mauve-dim">
          Add the scenes, cultures or communities this event is built around. Type to search Hapnin&rsquo;s tags, or add up to {CUSTOM_TAG_MAX} of your own.
        </p>
        {tags.map((t) => (
          <input key={`s-${t}`} type="hidden" name="scene_tags" value={t} />
        ))}
        {custom.map((t) => (
          <input key={`c-${t}`} type="hidden" name="custom_tags" value={t} />
        ))}

        {(tags.length > 0 || custom.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className={`${chip} border border-gold bg-gold/15 text-cream`}>
                {sceneTagLabel(t)}
                <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))} aria-label={`Remove ${sceneTagLabel(t)}`} className="text-mauve-dim hover:text-coral">×</button>
              </span>
            ))}
            {custom.map((t) => (
              <span key={t} className={`${chip} border border-dashed border-mauve-dim/70 text-cream`} title="Your own tag">
                {t}
                <button type="button" onClick={() => setCustom((p) => p.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-mauve-dim hover:text-coral">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <input
            id="scene-search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setNote(null); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={tags.length || custom.length ? "Add another…" : "Search: afrobeats, Nigerian, day party…"}
            autoComplete="off"
            className={inputClass}
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-plum-hi bg-plum p-2 shadow-2xl shadow-black/40">
              {customCheck && !customCheck.ok && needle && matches.length === 0 && (
                <p className="px-3 py-2 text-sm text-coral">{customCheck.error}</p>
              )}
              {customDup && <p className="px-3 py-2 text-sm text-coral">You already added that one.</p>}
              {GROUPS.map((g) => {
                const rows = listRows.filter((t) => t.group === g);
                if (rows.length === 0) return null;
                return (
                  <div key={g} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.14em] text-mauve-dim/80">{SCENE_GROUP_LABELS[g]}</p>
                    <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                      {rows.map((t) => (
                        <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addTag(t.id)} className="rounded-full border border-plum-hi bg-ink/40 px-3 py-1.5 text-sm text-mauve-dim hover:border-gold hover:text-cream">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {needle && matches.length === 0 && !customCheck && <p className="px-3 py-2 text-sm text-mauve-dim">No Hapnin tag matches.</p>}
              {/* Hapnin's tags first; the organizer's own tag is the last resort */}
              {canOfferCustom && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addCustom} className="mt-1 flex w-full items-center justify-between rounded-lg border border-dashed border-mauve-dim/60 px-3 py-2 text-left text-sm text-cream hover:border-gold">
                  <span>{matches.length ? "None of these? " : ""}Add <span className="font-semibold">&ldquo;{customCheck!.ok ? customCheck!.value : ""}&rdquo;</span> as your own tag</span>
                  <span className="text-xs text-mauve-dim">{custom.length}/{CUSTOM_TAG_MAX}</span>
                </button>
              )}
            </div>
          )}
        </div>
        {note && <p className="mt-1 text-sm text-coral">{note}</p>}
        {errors.custom_tags && <p className="mt-1 text-sm text-coral">{errors.custom_tags}</p>}
        {errors.scene_tags && <p className="mt-1 text-sm text-coral">{errors.scene_tags}</p>}
      </div>

      <div className="sm:max-w-xs">
        <label className={labelClass} htmlFor="primary_language">Language (optional)</label>
        <select id="primary_language" name="primary_language" defaultValue={defaults?.primary_language ?? ""} className={`${inputClass} [color-scheme:dark]`}>
          <option value="">Not specified</option>
          {LANGUAGE_CODE.map((o) => (
            <option key={o} value={o}>{humanize(o)}</option>
          ))}
        </select>
        {errors.primary_language && <p className="mt-1 text-sm text-coral">{errors.primary_language}</p>}
      </div>
    </div>
  );
}
