#!/usr/bin/env node
// codegen.js — generates packages/events-schema/generated/events.ts from schema.json
// Run: node packages/events-schema/codegen.js

const fs = require('fs');
const path = require('path');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
);

/** Map schema field types to TypeScript types */
function tsType(fieldType) {
  switch (fieldType) {
    case 'u64':
    case 'i128':
      return 'bigint';
    case 'u32':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'address':
    case 'string':
      return 'string';
    default:
      return 'unknown';
  }
}

/** snake_case → PascalCase */
function toPascal(s) {
  return s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

/** snake_case → camelCase */
function toCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

const events = schema.events;
const lines = [
  '// GENERATED FILE — do not edit manually.',
  '// Source of truth: packages/events-schema/schema.json',
  `// Schema version: ${schema.version}`,
  '// To regenerate: node packages/events-schema/codegen.js',
  '',
];

const typeNames = [];

for (const [topic, def] of Object.entries(events)) {
  const typeName = toPascal(topic) + 'Event';
  typeNames.push(typeName);

  lines.push(`export interface ${typeName} {`);
  lines.push(`  type: '${topic}';`);

  for (const [field, ftype] of Object.entries(def.fields)) {
    lines.push(`  ${toCamel(field)}: ${tsType(ftype)};`);
  }

  lines.push('}', '');
}

// Union type
lines.push(`export type ContractEvent =`);
typeNames.forEach((name, i) => {
  const sep = i < typeNames.length - 1 ? ' |' : ';';
  lines.push(`  | ${name}${sep}`);
});
lines.push('');

// Topic literal union
lines.push(`export type ContractEventTopic = ContractEvent['type'];`);
lines.push('');

// All valid topics as a const array (useful for indexer filtering)
lines.push(`export const CONTRACT_EVENT_TOPICS: ContractEventTopic[] = [`);
for (const topic of Object.keys(events)) {
  lines.push(`  '${topic}',`);
}
lines.push('];');
lines.push('');

const outDir = path.join(__dirname, 'generated');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'events.ts');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Generated ${outPath} (${typeNames.length} event types)`);
