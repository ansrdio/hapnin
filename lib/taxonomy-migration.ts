// Shared logic for the one-shot event taxonomy migration, used by both the
// CLI script (scripts/migrate-event-taxonomy.ts) and the temporary admin
// route. Server-side only by nature (it takes a Firestore Admin instance) but
// deliberately free of the `server-only` marker so the CLI can import it.
//
// Rules (unchanged from the original script):
//   · category / scene_tags are DERIVED from legacy event_type / community / genre
//     via lib/taxonomy.ts — nothing else is inferred.
//   · An event whose stored values already equal the derived values is
//     "already_migrated" and untouched.
//   · An event with stored values that DIFFER from the derivation was set by
//     hand (or written by the new forms) and is "skipped" — never overwritten
//     unless `force` is passed, which only the CLI exposes.
//   · Everything else "would_migrate"; apply writes exactly those two fields.

import type { Firestore } from "firebase-admin/firestore";
import { isCategory, normalizeSceneTags, deriveCategory, deriveSceneTags, type Category, type SceneTag } from "./taxonomy.ts";

export type MigrationStatus = "would_migrate" | "already_migrated" | "skipped";

export type MigrationRow = {
  id: string;
  title: string;
  is_sample: boolean;
  current: { event_type: string | null; community: string | null; genre: string | null; primary_language: string | null };
  existing: { category: string | null; scene_tags: string[] | null };
  proposed: { category: Category; scene_tags: SceneTag[] };
  status: MigrationStatus;
};

export type MigrationPlan = {
  rows: MigrationRow[];
  counts: { total: number; would_migrate: number; already_migrated: number; skipped: number };
};

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Read every event and decide what the migration would do. Performs no writes. */
export async function planTaxonomyMigration(db: Firestore, opts: { force?: boolean } = {}): Promise<MigrationPlan> {
  const snap = await db.collection("events").get();
  const rows: MigrationRow[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const current = {
      event_type: typeof d.event_type === "string" ? d.event_type : null,
      community: typeof d.community === "string" ? d.community : null,
      genre: typeof d.genre === "string" ? d.genre : null,
      primary_language: typeof d.primary_language === "string" ? d.primary_language : null,
    };
    const proposed = { category: deriveCategory(current), scene_tags: deriveSceneTags(current) };
    const existing = {
      category: isCategory(d.category) ? d.category : null,
      scene_tags: Array.isArray(d.scene_tags) ? normalizeSceneTags(d.scene_tags) : null,
    };

    let status: MigrationStatus = "would_migrate";
    if (existing.category && existing.scene_tags) {
      if (existing.category === proposed.category && same(existing.scene_tags, proposed.scene_tags)) status = "already_migrated";
      else if (!opts.force) status = "skipped";
    }
    rows.push({ id: doc.id, title: typeof d.title === "string" ? d.title : "(untitled)", is_sample: !!d.is_sample, current, existing, proposed, status });
  }
  const counts = {
    total: rows.length,
    would_migrate: rows.filter((r) => r.status === "would_migrate").length,
    already_migrated: rows.filter((r) => r.status === "already_migrated").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
  };
  return { rows, counts };
}

/** Write category + scene_tags for every "would_migrate" row of a plan. Returns how many were updated. */
export async function applyTaxonomyMigration(db: Firestore, plan: MigrationPlan): Promise<number> {
  let updated = 0;
  for (const r of plan.rows) {
    if (r.status !== "would_migrate") continue;
    await db.collection("events").doc(r.id).update({ category: r.proposed.category, scene_tags: r.proposed.scene_tags });
    updated++;
  }
  return updated;
}
