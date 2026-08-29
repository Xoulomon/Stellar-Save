#!/usr/bin/env node
/**
 * Performance budget check for the production bundle.
 *
 * Scans the Vite build output (`dist/`) and compares the gzipped size of the
 * JavaScript and CSS assets against the budgets declared in `bundle-budget.json`.
 * Exits non-zero when any budget is exceeded so CI can block the regression.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs            # check against the budget
 *   node scripts/check-bundle-size.mjs --update   # rewrite the recorded measurements
 *   node scripts/check-bundle-size.mjs --json     # emit a machine-readable report
 *
 * No third-party dependencies — only Node built-ins.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BUDGET_FILE = join(ROOT, 'bundle-budget.json');

const args = new Set(process.argv.slice(2));
const UPDATE = args.has('--update');
const JSON_OUT = args.has('--json');

/** Recursively collect files under `dir` matching one of `extensions`. */
function collectFiles(dir, extensions) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function gzipKib(buffer) {
  return gzipSync(buffer, { level: 9 }).length / 1024;
}

function round(kib) {
  return Math.round(kib * 100) / 100;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (
  !(() => {
    try {
      return statSync(DIST).isDirectory();
    } catch {
      return false;
    }
  })()
) {
  fail(`No build output found at ${relative(ROOT, DIST)}/. Run "npm run build" first.`);
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));

const jsFiles = collectFiles(DIST, ['.js', '.mjs']);
const cssFiles = collectFiles(DIST, ['.css']);

const perFile = [...jsFiles, ...cssFiles]
  .map((file) => ({
    path: relative(DIST, file).replace(/\\/g, '/'),
    kind: file.endsWith('.css') ? 'css' : 'js',
    gzipKib: round(gzipKib(readFileSync(file))),
  }))
  .sort((a, b) => b.gzipKib - a.gzipKib);

const totalJsGzip = round(
  perFile.filter((f) => f.kind === 'js').reduce((s, f) => s + f.gzipKib, 0)
);
const totalCssGzip = round(
  perFile.filter((f) => f.kind === 'css').reduce((s, f) => s + f.gzipKib, 0)
);
const largestChunkGzip = round(
  Math.max(0, ...perFile.filter((f) => f.kind === 'js').map((f) => f.gzipKib))
);

const measured = {
  totalJsGzipKib: totalJsGzip,
  totalCssGzipKib: totalCssGzip,
  largestChunkGzipKib: largestChunkGzip,
};

const checks = [
  ['Total JS (gzip)', totalJsGzip, budget.budgets.totalJsGzipKib],
  ['Total CSS (gzip)', totalCssGzip, budget.budgets.totalCssGzipKib],
  ['Largest JS chunk (gzip)', largestChunkGzip, budget.budgets.largestChunkGzipKib],
].filter(([, , limit]) => typeof limit === 'number');

if (JSON_OUT) {
  console.log(JSON.stringify({ measured, budgets: budget.budgets, files: perFile }, null, 2));
}

if (UPDATE) {
  writeFileSync(BUDGET_FILE, `${JSON.stringify({ ...budget, measured }, null, 2)}\n`);
  console.log(`Updated ${relative(ROOT, BUDGET_FILE)} with the current measurements:`);
  console.log(measured);
  process.exit(0);
}

console.log('\nBundle size budget\n');
const failures = [];
for (const [label, actual, limit] of checks) {
  const ok = actual <= limit;
  const pct = Math.round((actual / limit) * 100);
  console.log(
    `  ${ok ? '✓' : '✗'} ${label.padEnd(26)} ${String(actual).padStart(8)} KiB / ${limit} KiB budget (${pct}%)`
  );
  if (!ok) failures.push(`${label}: ${actual} KiB exceeds the ${limit} KiB budget`);
}

console.log('\n  Largest assets:');
for (const file of perFile.slice(0, 8)) {
  console.log(`    ${String(file.gzipKib).padStart(8)} KiB  ${file.path}`);
}

if (failures.length > 0) {
  console.error('\n✗ Performance budget exceeded:');
  for (const failure of failures) console.error(`    - ${failure}`);
  console.error(
    '\n  If this growth is intentional, update bundle-budget.json (see docs/bundle-budget.md)\n' +
      '  or run "npm run size:update" to record the new baseline.\n'
  );
  process.exit(1);
}

console.log('\n✓ Bundle is within the performance budget.\n');
