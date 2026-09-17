// Parsing of the classification block shared by every event form (organizer
// create, organizer edit, guest create, admin create). Pure and dependency-
// free so it can be unit-tested; lib/event-input.ts re-exports it.
//
// Contract: Category is required. Scene tags and custom tags are repeated
// fields (FormData.getAll — a single-value read would silently keep only the
// first chip). Language is optional: "Not specified" (empty, or the field
// absent) parses to null and MUST be persisted as null, never defaulted.
// Genre is no longer organizer-facing: any `genre` field in a submission is
// ignored, and nothing here ever produces one.

import { LANGUAGE_CODE, isOneOf, type LanguageCode } from "./enums.ts";
import { isCategory, normalizeSceneTags, parseCustomTags, type Category, type SceneTag } from "./taxonomy.ts";
import type { FieldErrors } from "./validation";

export type ParsedClassification = {
  category: Category | null;
  scene_tags: SceneTag[];
  custom_tags: string[];
  primary_language: LanguageCode | null;
  fieldErrors: FieldErrors;
};

export function parseClassification(formData: FormData): ParsedClassification {
  const categoryRaw = String(formData.get("category") ?? "");
  const category = isCategory(categoryRaw) ? categoryRaw : null;
  const scene_tags = normalizeSceneTags(formData.getAll("scene_tags").map(String));
  const custom = parseCustomTags(formData.getAll("custom_tags").map(String));
  const langRaw = String(formData.get("primary_language") ?? "");
  const fieldErrors: FieldErrors = {};
  if (!category) fieldErrors.category = "Pick what kind of event this is.";
  if (custom.error) fieldErrors.custom_tags = custom.error;
  if (langRaw && !isOneOf(LANGUAGE_CODE, langRaw)) fieldErrors.primary_language = "Pick one, or leave it blank.";
  return {
    category,
    scene_tags,
    custom_tags: custom.tags,
    primary_language: isOneOf(LANGUAGE_CODE, langRaw) ? langRaw : null,
    fieldErrors,
  };
}
