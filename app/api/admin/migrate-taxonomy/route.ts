import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/firebase-admin";
import { planTaxonomyMigration, applyTaxonomyMigration } from "@/lib/taxonomy-migration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — one-shot event taxonomy migration, run inside the Vercel
// runtime because the Firebase service-account variables are Sensitive and
// cannot be pulled locally. Delete this file once the migration is applied
// and verified (the shared logic in lib/taxonomy-migration.ts stays).
//
// Guarded by the same admin session check as /admin (ADMIN_EMAILS allowlist).
// POST only. Dry run by default; writes require BOTH `apply: true` and the
// exact confirmation string. `force` is deliberately not accepted here.
//
//   POST /api/admin/migrate-taxonomy   body: {"apply": false}
//   POST /api/admin/migrate-taxonomy   body: {"apply": true, "confirmation": "APPLY_EVENT_TAXONOMY_MIGRATION"}

const CONFIRMATION = "APPLY_EVENT_TAXONOMY_MIGRATION";

export async function POST(req: Request) {
  await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as { apply?: unknown; confirmation?: unknown };
  const apply = body.apply === true;
  if (apply && body.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: "confirmation_required", message: `To write, send {"apply": true, "confirmation": "${CONFIRMATION}"}.` }, { status: 400 });
  }

  const db = getDb();
  const plan = await planTaxonomyMigration(db); // never force from this route
  let updated = 0;
  if (apply) updated = await applyTaxonomyMigration(db, plan);

  return NextResponse.json({
    mode: apply ? "apply" : "dry_run",
    counts: { ...plan.counts, updated },
    events: plan.rows,
  });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed", message: "POST a JSON body; dry run is the default." }, { status: 405 });
}
