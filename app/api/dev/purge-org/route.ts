import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { getOrganizerByHandle } from "@/lib/organizers";

export const runtime = "nodejs";

// Admin-only test-data purge. Deletes EVERY event under an organizer handle
// and all per-event data — regardless of sales, which the normal delete
// (rightly) refuses. Meant for the seeded @aura org and stray test events.
//
// Safety: dry run by default (reports what WOULD go); writes only with
// &apply=1 AND &confirm=<handle> repeated back. The organizer doc, its team,
// and the shared `buyers` collection (keyed by phone, used across organizers)
// are never touched. Remove before launch.
const PER_EVENT = ["orders", "tickets", "pending_orders", "promoter_links", "promo_codes", "waitlist_entries", "broadcasts"] as const;

async function deleteAll(refs: FirebaseFirestore.DocumentReference[]) {
  const db = getDb();
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const handle = url.searchParams.get("handle");
  const apply = url.searchParams.get("apply") === "1";
  const confirm = url.searchParams.get("confirm");
  // &org=1 also removes the organizer shell itself (doc, handle reservation,
  // team memberships) once its events are gone — for retiring test orgs.
  const removeOrg = url.searchParams.get("org") === "1";
  if (!handle) return NextResponse.json({ error: "pass ?handle=..." }, { status: 400 });

  const organizer = await getOrganizerByHandle(handle);
  if (!organizer) return NextResponse.json({ error: `no organizer @${handle}` }, { status: 404 });
  if (apply && confirm !== handle) {
    return NextResponse.json({ error: `to apply, repeat the handle: &confirm=${handle}` }, { status: 400 });
  }

  const db = getDb();
  const events = await db.collection("events").where("organizer_id", "==", organizer.id).get();

  const plan: { eventId: string; title: string; slug: string | null; counts: Record<string, number> }[] = [];
  const toDelete: FirebaseFirestore.DocumentReference[] = [];

  for (const ev of events.docs) {
    const d = ev.data();
    const counts: Record<string, number> = {};
    const tiers = await ev.ref.collection("tiers").get();
    counts.tiers = tiers.size;
    toDelete.push(...tiers.docs.map((t) => t.ref));
    for (const coll of PER_EVENT) {
      const snap = await db.collection(coll).where("event_id", "==", ev.id).get();
      counts[coll] = snap.size;
      toDelete.push(...snap.docs.map((x) => x.ref));
    }
    if (d.slug) toDelete.push(db.collection("event_slugs").doc(String(d.slug).toLowerCase()));
    toDelete.push(ev.ref);
    plan.push({ eventId: ev.id, title: d.title, slug: d.slug ?? null, counts });
  }

  // The org shell — only on request, and only after its events are in the
  // same delete list (so a partial run can't leave events without an owner).
  let orgShell: Record<string, number> | null = null;
  if (removeOrg) {
    const team = await db.collection("team_members").where("organizer_id", "==", organizer.id).get();
    toDelete.push(...team.docs.map((t) => t.ref));
    toDelete.push(db.collection("handles").doc(organizer.handle));
    toDelete.push(db.collection("organizers").doc(organizer.id));
    orgShell = { team_members: team.size, handle: 1, organizer: 1 };
  }

  if (apply) await deleteAll(toDelete);

  return NextResponse.json({
    handle,
    organizerId: organizer.id,
    events: plan,
    orgShell: orgShell ?? "kept (add &org=1 to remove the organizer doc, handle, and team)",
    documents: toDelete.length,
    applied: apply,
    hint: apply ? undefined : `dry run — nothing deleted. To delete: &apply=1&confirm=${handle}${removeOrg ? "&org=1" : ""}`,
    untouched: [
      ...(removeOrg ? [] : ["organizer doc", "team_members"]),
      "buyers (shared, keyed by phone)",
      "the Stripe connected account, if any (remove in Stripe → Connected accounts)",
    ],
  });
}
