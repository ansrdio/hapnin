// Parsing of the classification block shared by every event form (organizer
// create, organizer edit, guest create, admin create). Pure and dependency-
// free so it can be unit-tested; lib/event-input.ts re-exports it.
//
// Contract: Category is required. Scene tags are a repeated field
// (FormData.getAll — a single-value read would silently keep only the first
// chip). Language and genre are optional: "Not specified" (empty value, or the
// field absent from the form) parses to null and MUST be persisted as null,
// never omitted and never defaulted.

import { LANGUAGE_CODE, GENRE, isOneOf, type LanguageCode, type Genre } from "./enums.ts";
import { isCategory, normalizeSceneTags, type Category, type SceneTag } from "./taxonomy.ts";
import type { FieldErrors } from "./validation";

export type ParsedClassification = {
  category: Category | null;
  scene_tags: SceneTag[];
  primary_language: LanguageCode | null;
  genre: Genre | null;
  fieldErrors: FieldErrors;
};

export function parseClassification(formData: FormData): ParsedClassification {
  const categoryRaw = String(formData.get("category") ?? "");
  const category = isCategory(categoryRaw) ? categoryRaw : null;
  const scene_tags = normalizeSceneTags(formData.getAll("scene_tags").map(String));
  const langRaw = String(formData.get("primary_language") ?? "");
  const genreRaw = String(formData.get("genre") ?? "");
  const fieldErrors: FieldErrors = {};
  if (!category) fieldErrors.category = "Pick what kind of event this is.";
  if (langRaw && !isOneOf(LANGUAGE_CODE, langRaw)) fieldErrors.primary_language = "Pick one, or leave it blank.";
  if (genreRaw && !isOneOf(GENRE, genreRaw)) fieldErrors.genre = "Pick one, or leave it blank.";
  return {
    category,
    scene_tags,
    primary_language: isOneOf(LANGUAGE_CODE, langRaw) ? langRaw : null,
    genre: isOneOf(GENRE, genreRaw) ? genreRaw : null,
    fieldErrors,
  };
}
