#!/usr/bin/env node
// check-rust-drift.js — fails if the topics emitted by the events domain
// modules and the topics in schema.json diverge.
//
// Mirrors the `test_every_*_topic_*` unit tests in events.rs so the check also
// runs in CI without a Rust toolchain. The loaders and rules live in
// contract-sources.js, shared with the backend contract test.

const {
  loadSchema,
  loadDomainSources,
  findMissingSchemaVersionFields,
  findMissingSchemaVersionConstants,
  findTopicDrift,
} = require('./contract-sources.js');

const schema = loadSchema();
const domainSources = loadDomainSources();

// 1. Every schema entry has schema_version.
const missingVersion = findMissingSchemaVersionFields(schema);
if (missingVersion.length > 0) {
  console.error(
    '\n❌ schema.json is missing schema_version in the following events:\n' +
    missingVersion.map((t) => `   • ${t}`).join('\n') + '\n' +
    '   Add "schema_version": "u32" as the first field of each entry.\n'
  );
  process.exit(1);
}

// 2. Every domain file declares a *_SCHEMA_VERSION constant.
const missingConst = findMissingSchemaVersionConstants(domainSources);
if (missingConst.length > 0) {
  console.error(
    '\n❌ The following domain files are missing a *_SCHEMA_VERSION constant:\n' +
    missingConst.map((file) => `   • ${file}`).join('\n') + '\n'
  );
  process.exit(1);
}

// 3. Topics agree in both directions.
const drift = findTopicDrift(schema, domainSources);
if (drift.missingFromSchema.length || drift.missingEmitter.length) {
  console.error('\n❌ events domain modules ↔ schema.json drift detected!');
  if (drift.missingFromSchema.length) {
    console.error(
      '   Emitted in domain modules but missing from schema.json: ' +
      drift.missingFromSchema.join(', ')
    );
  }
  if (drift.missingEmitter.length) {
    console.error(
      '   In schema.json but no emitter in domain modules: ' +
      drift.missingEmitter.join(', ')
    );
  }
  process.exit(1);
}

process.stdout.write(
  `✅ Domain modules and schema.json agree on ${drift.schemaTopicCount} topics ` +
  `(all with schema_version).\n`
);
