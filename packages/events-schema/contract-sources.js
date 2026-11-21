// Shared loaders and drift checks for the contract event schema.
//
// Used by check-rust-drift.js (runs in CI without a Rust toolchain) and by
// backend/src/tests/events-schema-contract.test.ts. Keep the file reading,
// topic parsing and drift rules here only.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(__dirname, 'schema.json');
const EVENTS_RS_PATH = path.join(REPO_ROOT, 'contracts', 'stellar-save', 'src', 'events.rs');
const EVENTS_DIR = path.join(REPO_ROOT, 'contracts', 'stellar-save', 'src', 'events');
const DOMAIN_FILES = ['group.rs', 'contribution.rs', 'payout.rs', 'admin.rs'];
const TOPIC_PATTERN = /publish\(\s*\(\s*"([a-z0-9_]+)"/g;

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function loadEventsRs() {
  return fs.readFileSync(EVENTS_RS_PATH, 'utf8');
}

function loadDomainSources() {
  return DOMAIN_FILES.map((file) => {
    const filePath = path.join(EVENTS_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Expected domain file not found: ${filePath}`);
    }
    return { file, src: fs.readFileSync(filePath, 'utf8') };
  });
}

function emittedTopicsIn(src) {
  return [...src.matchAll(TOPIC_PATTERN)].map((match) => match[1]);
}

// Returns the topics whose schema entry has no schema_version field.
function findMissingSchemaVersionFields(schema) {
  return Object.entries(schema.events)
    .filter(([, def]) => !Object.prototype.hasOwnProperty.call(def.fields, 'schema_version'))
    .map(([topic]) => topic);
}

// Returns the domain files that do not declare a *_SCHEMA_VERSION constant.
function findMissingSchemaVersionConstants(domainSources) {
  return domainSources
    .filter(({ src }) => !/_SCHEMA_VERSION:\s*u32\s*=/.test(src))
    .map(({ file }) => file);
}

// Compares topics emitted by the domain modules with the topics in the schema.
function findTopicDrift(schema, domainSources) {
  const schemaTopics = new Set(Object.values(schema.events).map((entry) => entry.topic));
  const emitted = new Set(domainSources.flatMap(({ src }) => emittedTopicsIn(src)));
  return {
    missingFromSchema: [...emitted].filter((topic) => !schemaTopics.has(topic)),
    missingEmitter: [...schemaTopics].filter((topic) => !emitted.has(topic)),
    schemaTopicCount: schemaTopics.size,
  };
}

module.exports = {
  loadSchema,
  loadEventsRs,
  loadDomainSources,
  emittedTopicsIn,
  findMissingSchemaVersionFields,
  findMissingSchemaVersionConstants,
  findTopicDrift,
};
