// One-shot migration: derive `category` + `scene_tags` for events that predate
// the taxonomy (lib/taxonomy.ts) from their legacy event_type / community /
// genre. Additive: no field is removed or renamed.
//
//   npm run migrate:taxonomy -- --env .env.production.local            # dry run (default)
//   npm run migrate:taxonomy -- --env .env.production.local --apply    # write
//
// Reads FIREBASE_* from the environment, or from the file given with --env
// (default .env.local). The production service-account values live only in
// Vercel: pull them first with
//   npx vercel env pull .env.production.local --environment=production
// and delete that file when done. Safe to re-run:
// events whose stored values already equal the derived values are skipped.
// Events with a hand-set category/tags that differ from what the legacy
// fields would derive are reported and left alone unless --force is passed
// (never needed in normal use — it exists so a mistaken run can be corrected).

import { readFileSync, existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isCategory, normalizeSceneTags, deriveCategory, deriveSceneTags, CATEGORIES, sceneTagLabel } from "../lib/taxonomy.ts";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const ENV_FILE = process.argv[process.argv.indexOf("--env") + 1] && process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : ".env.local";

function loadDotEnv(path = ENV_FILE) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function db() {
  loadDotEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
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
