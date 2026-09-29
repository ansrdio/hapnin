"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parsePlaceForm, type PlaceValues } from "@/lib/place-input";
import { parseStoryForm, eventSlugFromRef, type StoryValues } from "@/lib/story-input";
import { createPlace, updatePlace, setPlaceStatus, getPlaceById } from "@/lib/places";
import { createStory, updateStory, setStoryStatus, getStoryById } from "@/lib/stories";
import { getEventBySlug, getEventById, setEventPlace } from "@/lib/events";
import type { ActionState } from "./action-state";

// Admin content actions for Experiment 001 (Places + Inside the Culture).
// Every action re-checks the admin allowlist first.

const revalidatePlaces = (slug?: string) => {
  revalidatePath("/places");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/places/${slug}`);
};
const revalidateStories = (slug?: string) => {
  revalidatePath("/stories");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/stories/${slug}`);
};

// ── Places ──────────────────────────────────────────────────────────────────

export async function createPlaceDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { values, fieldErrors } = parsePlaceForm(formData);
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };
  let id: string;
  try {
    id = (await createPlace(values as PlaceValues)).id;
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { name: "A place with that link already exists — change the name or set a different link." } };
    console.error("createPlace error", err);
    return { status: "error", message: "Couldn’t create the place." };
  }
  redirect(`/admin/places/${id}`);
}

export async function updatePlaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { values, fieldErrors } = parsePlaceForm(formData);
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };
  try {
    await updatePlace(id, values as PlaceValues);
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { slug: "That link is taken." } };
    console.error("updatePlace error", err);
    return { status: "error", message: "Couldn’t save." };
  }
  revalidatePlaces(values.slug);
  return { status: "success", message: "Saved." };
}

export async function setPlaceStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";
  const place = await getPlaceById(id);
  if (!place) return;
  await setPlaceStatus(id, status);
  revalidatePlaces(place.slug);
  revalidatePath(`/admin/places/${id}`);
}

/** Link an event (by its link or slug) to this place. */
export async function linkEventToPlaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const placeId = String(formData.get("place_id") ?? "");
  const slug = eventSlugFromRef(String(formData.get("event_ref") ?? ""));
  const place = await getPlaceById(placeId);
  if (!place) return { status: "error", message: "Place not found." };
  if (!slug) return { status: "error", fieldErrors: { event_ref: "Paste the event’s link, e.g. https://www.hapnin.now/e/taste-of-nigeria." } };
  const event = await getEventBySlug(slug);
  if (!event) return { status: "error", fieldErrors: { event_ref: `No event at /e/${slug}.` } };
  await setEventPlace(event.id, place.id);
  revalidatePath(`/e/${event.slug}`);
  revalidatePlaces(place.slug);
  revalidatePath(`/admin/places/${placeId}`);
  return { status: "success", message: `Linked “${event.title}”.` };
}

export async function unlinkEventFromPlaceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("event_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const event = await getEventById(eventId);
  if (!event || event.place_id !== placeId) return;
  await setEventPlace(event.id, null);
  const place = await getPlaceById(placeId);
  revalidatePath(`/e/${event.slug}`);
  revalidatePlaces(place?.slug);
  revalidatePath(`/admin/places/${placeId}`);
}

// ── Stories ─────────────────────────────────────────────────────────────────

async function resolveEventRefs(refs: string[]): Promise<{ ids: string[]; missing: string[] }> {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const slug of refs) {
    const e = await getEventBySlug(slug);
    if (e) ids.push(e.id);
    else missing.push(slug);
  }
  return { ids, missing };
}

export async function createStoryDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { values, fieldErrors } = parseStoryForm(formData);
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };
  const { event_refs: _refs, ...rest } = values as StoryValues; // eslint-disable-line @typescript-eslint/no-unused-vars
  let id: string;
  try {
    id = (await createStory({ ...rest, event_ids: [] })).id;
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { title: "A story with that link already exists — change the title or set a different link." } };
    console.error("createStory error", err);
    return { status: "error", message: "Couldn’t create the story." };
  }
  redirect(`/admin/stories/${id}`);
}

export async function updateStoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { values, fieldErrors } = parseStoryForm(formData);
  const { ids, missing } = await resolveEventRefs(values.event_refs ?? []);
  if (missing.length) fieldErrors.event_refs = `No event at: ${missing.map((m) => `/e/${m}`).join(", ")}.`;
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };
  const { event_refs: _refs, ...rest } = values as StoryValues; // eslint-disable-line @typescript-eslint/no-unused-vars
  try {
    await updateStory(id, { ...rest, event_ids: ids });
  } catch (err) {
    if ((err as Error).message === "SLUG_TAKEN") return { status: "error", fieldErrors: { slug: "That link is taken." } };
    console.error("updateStory error", err);
    return { status: "error", message: "Couldn’t save." };
  }
  revalidateStories(values.slug);
  return { status: "success", message: "Saved." };
}

export async function setStoryStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";
  const story = await getStoryById(id);
  if (!story) return;
  await setStoryStatus(id, status);
  revalidateStories(story.slug);
  revalidatePath(`/admin/stories/${id}`);
}
