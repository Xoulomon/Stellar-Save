#!/usr/bin/env node
// check-drift.js — used by CI to detect schema/codegen drift.
// Regenerates the TypeScript types and exits non-zero if the result
// differs from what is already committed.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

console.log('✅ Event schema is in sync.');
