#!/usr/bin/env node
/**
 * audit-i18n-keys.mjs — report translation keys that are defined but unused,
 * and translation keys that are used but never defined.
 *
 * Deliberately NOT wired into CI. It is a maintenance aid: run it before and
 * after touching locale files to see what a change would orphan.
 *
 *   node scripts/audit-i18n-keys.mjs            # audit the live locales
 *   node scripts/audit-i18n-keys.mjs --dir src/i18n/locales
 *   node scripts/audit-i18n-keys.mjs --json
 *
 * Exit codes:
 *   0  no missing keys (unused keys may still be reported)
 *   1  at least one key is referenced in code but not defined in any locale
 *
 * A "missing" key is a real bug: it renders as the raw key string at runtime.
 * An "unused" key is only dead weight.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// ── Arguments ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dirFlag = args.indexOf('--dir');
const LOCALE_DIR = resolve(ROOT, dirFlag !== -1 ? args[dirFlag + 1] : 'src/locales');
const SRC_DIR = resolve(ROOT, 'src');
const REFERENCE = 'en.json';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively flatten an object into dot-separated leaf paths. */
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Every file under `dir` matching `ext`, recursively. */
function walk(dir, ext) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, ext));
    } else if (full.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

// ── Collect defined keys ──────────────────────────────────────────────────────

let localeFiles;
try {
  localeFiles = walk(LOCALE_DIR, '.json').sort();
} catch {
  console.error(`✖ No locale directory at ${relative(ROOT, LOCALE_DIR)}`);
  process.exit(1);
}

if (localeFiles.length === 0) {
  console.error(`✖ No .json locale files in ${relative(ROOT, LOCALE_DIR)}`);
  process.exit(1);
}

const definedByLocale = new Map();
for (const file of localeFiles) {
  const code = relative(LOCALE_DIR, file).replace(/\.json$/, '');
  definedByLocale.set(code, flattenKeys(readJson(file)));
}

const referenceFile = localeFiles.find((f) => f.endsWith(REFERENCE));
const referenceKeys = new Set(
  referenceFile ? flattenKeys(readJson(referenceFile)) : definedByLocale.values().next().value
);

// ── Collect referenced keys ───────────────────────────────────────────────────

// Matches t('x'), t("x"), i18n.t('x'), and useTranslation()-style lookups.
const LOOKUP = /\bt\(\s*['"`]([a-zA-Z0-9_]+(?:[.\-_][a-zA-Z0-9_]+)+)['"`]/g;
// Dynamic lookups cannot be resolved statically; report them so they are not
// mistaken for "unused" keys.
const DYNAMIC = /\bt\(\s*[`'"][^`'"]*\$\{/g;

const referenced = new Set();
const dynamicSites = [];

for (const file of walk(SRC_DIR, '.ts').concat(walk(SRC_DIR, '.tsx'))) {
  if (file.includes(`${'test'}/`)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(LOOKUP)) referenced.add(match[1]);
  if (DYNAMIC.test(text)) dynamicSites.push(relative(ROOT, file));
}

// ── Report ────────────────────────────────────────────────────────────────────

const unused = [...referenceKeys].filter((k) => !referenced.has(k)).sort();
const missing = [...referenced].filter((k) => !referenceKeys.has(k)).sort();

// Locales must not drift from the reference locale.
const parity = [];
for (const [code, keys] of definedByLocale) {
  if (code === 'en') continue;
  const set = new Set(keys);
  parity.push({
    code,
    missing: [...referenceKeys].filter((k) => !set.has(k)).sort(),
    extra: keys.filter((k) => !referenceKeys.has(k)).sort(),
  });
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        localeDir: relative(ROOT, LOCALE_DIR),
        locales: [...definedByLocale.keys()],
        totalKeys: referenceKeys.size,
        referenced: [...referenced].sort(),
        unused,
        missing,
        parity,
        dynamicSites: [...new Set(dynamicSites)].sort(),
      },
      null,
      2
    )
  );
} else {
  console.log(`i18n key audit — ${relative(ROOT, LOCALE_DIR)}`);
  console.log(`  locales: ${[...definedByLocale.keys()].join(', ')}`);
  console.log(`  keys in ${REFERENCE}: ${referenceKeys.size}`);
  console.log(`  keys referenced in code: ${referenced.size}\n`);

  console.log(`✖ Missing (referenced but not defined): ${missing.length}`);
  for (const k of missing) console.log(`    ${k}`);

  console.log(`\n⚠ Unused (defined but not referenced): ${unused.length}`);
  for (const k of unused) console.log(`    ${k}`);

  const drifting = parity.filter((p) => p.missing.length || p.extra.length);
  console.log(`\n≡ Locale parity: ${drifting.length === 0 ? 'all locales match en.json' : 'DRIFT'}`);
  for (const p of drifting) {
    if (p.missing.length) console.log(`    ${p.code} missing: ${p.missing.join(', ')}`);
    if (p.extra.length) console.log(`    ${p.code} extra:   ${p.extra.join(', ')}`);
  }

  const dyn = [...new Set(dynamicSites)].sort();
  if (dyn.length) {
    console.log(`\n? Dynamic lookups (not statically resolvable) in:`);
    for (const f of dyn) console.log(`    ${f}`);
  }
}

process.exit(missing.length > 0 ? 1 : 0);
