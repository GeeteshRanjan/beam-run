/**
 * Bundle budget gate (CI).
 *
 * Enforces the hard performance budget from the Ops doc against the built
 * `dist/`. The pass/fail policy lives in `budget.mjs` (shared with its unit
 * test). Exits non-zero if any budget is exceeded so CI fails the build.
 *
 * Budgets (gzipped): JS ≤ 90 KB, total lazy-loaded ≤ 250 KB.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { BUDGETS, evaluateBudget } from './budget.mjs';

const DIST = 'dist';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function gzipKB(file) {
  const buf = readFileSync(file);
  return gzipSync(buf).length / 1024;
}

function main() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    console.error(`✗ No ${DIST}/ directory — run \`vite build\` first.`);
    process.exit(1);
  }

  const js = files.filter((f) => f.endsWith('.js'));
  let jsGz = 0;
  for (const f of js) jsGz += gzipKB(f);

  const assetExts = ['.png', '.webp', '.ogg', '.mp3', '.woff2', '.woff'];
  let assetGz = 0;
  for (const f of files) {
    if (assetExts.some((e) => f.endsWith(e))) assetGz += gzipKB(f);
  }

  const totalGz = jsGz + assetGz;
  const { ok, problems } = evaluateBudget(jsGz, totalGz, BUDGETS);

  console.log('Bundle budget report (gzipped):');
  console.log(`  JS:     ${jsGz.toFixed(1)} KB / ${BUDGETS.jsGzipKB} KB`);
  console.log(`  Assets: ${assetGz.toFixed(1)} KB`);
  console.log(`  Total:  ${totalGz.toFixed(1)} KB / ${BUDGETS.totalGzipKB} KB`);

  if (!ok) {
    console.error('✗ Bundle budget exceeded:');
    for (const p of problems) console.error(`  · ${p}`);
    process.exit(1);
  }
  console.log('✓ Bundle within budget.');
}

main();
