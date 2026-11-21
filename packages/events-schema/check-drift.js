#!/usr/bin/env node
// check-drift.js — used by CI to detect schema/codegen drift.
// Regenerates the TypeScript types and exits non-zero if the result
// differs from what is already committed.
//
// Also validates that every schema entry has a schema_version field
// (codegen.js enforces the same rule, so this is a belt-and-suspenders check).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Pre-flight: schema_version validation ────────────────────────────────────
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const missingVersion = Object.entries(schema.events)
  .filter(([, def]) => !Object.prototype.hasOwnProperty.call(def.fields, 'schema_version'))
  .map(([topic]) => topic);

if (missingVersion.length > 0) {
  console.error(
    '\n❌ schema.json is missing schema_version in the following events:\n' +
    missingVersion.map((t) => `   • ${t}`).join('\n') + '\n' +
    '   Add "schema_version": "u32" as the first field of each entry.\n'
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const generatedPath = path.join(__dirname, 'generated', 'events.ts');
const before = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : '';

// Regenerate
require('./codegen.js');

const after = fs.readFileSync(generatedPath, 'utf8');

if (before !== after) {
  console.error(
    '\n❌ Event schema drift detected!\n' +
    '   packages/events-schema/generated/events.ts is out of sync with schema.json.\n' +
    '   Run "node packages/events-schema/codegen.js" and commit the result.\n'
  );
  process.exit(1);
}

// Also verify via git that the committed file matches what is on disk
try {
  execSync('git diff --exit-code packages/events-schema/generated/events.ts', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'inherit',
  });
} catch {
  console.error(
    '\n❌ Committed generated/events.ts differs from working tree.\n' +
    '   Commit the regenerated file before merging.\n'
  );
  process.exit(1);
}

process.stdout.write('✅ Event schema is in sync (schema_version present on all events).\n');
