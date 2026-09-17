// One-shot migration: derive `category` + `scene_tags` for events that predate
// the taxonomy (lib/taxonomy.ts) from their legacy event_type / community /
// genre. Additive: no field is removed or renamed.
//
// Production (Vercel injects the env; Sensitive variables are never written to disk):
//   npx vercel env run -e production -- npm run migrate:taxonomy              # dry run (default)
//   npx vercel env run -e production -- npm run migrate:taxonomy -- --apply   # write
//
// Local / non-sensitive env file:
//   npm run migrate:taxonomy -- --env .env.local
//
// With no --env, the Firebase variables are read straight from process.env.
// Before anything runs, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and
// FIREBASE_PRIVATE_KEY must be present and must not be the "[SENSITIVE]"
// placeholder Vercel writes on `env pull`; otherwise the script exits without
// touching Firestore. Secret values are never printed.
//
// Safe to re-run: events whose stored values already equal the derived values
// are skipped. Events with a hand-set category/tags that differ from what the
// legacy fields would derive are reported and left alone unless --force is
// passed (never needed in normal use — it exists so a mistaken run can be corrected).

import { readFileSync, existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isCategory, normalizeSceneTags, deriveCategory, deriveSceneTags, CATEGORIES, sceneTagLabel } from "../lib/taxonomy.ts";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const envFlag = process.argv.indexOf("--env");
const ENV_FILE: string | null = envFlag !== -1 ? (process.argv[envFlag + 1] ?? null) : null;

const REQUIRED = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const;
const PLACEHOLDER = "[SENSITIVE]";

function loadDotEnv(path: string) {
  if (!existsSync(path)) {
    console.error(`--env file not found: ${path}`);
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

/** Fail closed: every required variable present, non-empty, and not Vercel's Sensitive placeholder. Values are never echoed. */
function requireFirebaseEnv(): { projectId: string; clientEmail: string; privateKey: string } {
  const problems: string[] = [];
  for (const k of REQUIRED) {
    const v = process.env[k];
    if (!v || !v.trim()) problems.push(`${k} is missing`);
    else if (v.trim() === PLACEHOLDER || v.includes(PLACEHOLDER)) problems.push(`${k} is the ${PLACEHOLDER} placeholder (Sensitive variable not injected)`);
  }
  if (problems.length) {
    console.error("Refusing to run — Firebase credentials are not available:");
    for (const p of problems) console.error(`  · ${p}`);
    console.error(
      ENV_FILE
        ? `Checked ${ENV_FILE} and process.env.`
        : "Run under Vercel's env injection:  npx vercel env run -e production -- npm run migrate:taxonomy"
    );
    process.exit(1);
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID!.trim(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  };
}

function db() {
  if (ENV_FILE) loadDotEnv(ENV_FILE);
  const { projectId, clientEmail, privateKey } = requireFirebaseEnv();
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore();
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

async function main() {
  const fs = db();
  const snap = await fs.collection("events").get();
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} · ${snap.size} events · project ${process.env.FIREBASE_PROJECT_ID}\n`);

  let writes = 0, skipped = 0, conflicts = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const legacy = { event_type: d.event_type ?? null, community: d.community ?? null, genre: d.genre ?? null };
    const derivedCategory = deriveCategory(legacy);
    const derivedTags = deriveSceneTags(legacy);
    const storedCategory = isCategory(d.category) ? d.category : null;
    const storedTags = Array.isArray(d.scene_tags) ? normalizeSceneTags(d.scene_tags) : null;

    const title = `${doc.id}  "${d.title ?? "(untitled)"}"${d.is_sample ? "  [sample]" : ""}`;
    const current = `type=${legacy.event_type ?? "—"} community=${legacy.community ?? "—"} genre=${legacy.genre ?? "—"} lang=${d.primary_language ?? "—"}`;
    const target = `category=${derivedCategory} (${CATEGORIES.find((c) => c.id === derivedCategory)?.label}) tags=[${derivedTags.map(sceneTagLabel).join(", ")}]`;

    if (storedCategory && storedTags) {
      if (storedCategory === derivedCategory && same(storedTags, derivedTags)) {
        skipped++;
        console.log(`= ${title}\n    already migrated: ${target}`);
        continue;
      }
      if (!FORCE) {
        conflicts++;
        console.log(`! ${title}\n    stored:  category=${storedCategory} tags=[${storedTags.join(", ")}]\n    derived: ${target}\n    left alone (set by hand, or already the new model). Use --force to overwrite.`);
        continue;
      }
    }

    console.log(`${APPLY ? "→" : "·"} ${title}\n    current: ${current}\n    derived: ${target}`);
    if (APPLY) {
      await doc.ref.update({ category: derivedCategory, scene_tags: derivedTags });
      writes++;
    } else {
      writes++;
    }
  }
  console.log(`\n${APPLY ? "wrote" : "would write"} ${writes} · already migrated ${skipped} · left alone ${conflicts}`);
  if (!APPLY && writes > 0) console.log("Re-run with --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
