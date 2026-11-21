type EventFieldType = 'u64' | 'u32' | 'i128' | 'address' | 'string' | 'bool';

interface EventSchema {
  topic: string;
  fields: Record<string, EventFieldType>;
}

interface SourceFile {
  file: string;
  src: string;
}

interface TopicDrift {
  missingFromSchema: string[];
  missingEmitter: string[];
  schemaTopicCount: number;
}

// Shared loaders and drift rules, also used by packages/events-schema/check-rust-drift.js.
const contractSources = require('../../../packages/events-schema/contract-sources.js') as {
  loadSchema: () => { events: Record<string, EventSchema> };
  loadEventsRs: () => string;
  loadDomainSources: () => SourceFile[];
  emittedTopicsIn: (src: string) => string[];
  findMissingSchemaVersionFields: (schema: { events: Record<string, EventSchema> }) => string[];
  findMissingSchemaVersionConstants: (sources: SourceFile[]) => string[];
  findTopicDrift: (
    schema: { events: Record<string, EventSchema> },
    sources: SourceFile[],
  ) => TopicDrift;
};

const eventsSource = contractSources.loadEventsRs();
const eventSchema = contractSources.loadSchema();
const emitterSource = eventsSource.split(/#\[cfg\(test\)\]\s*mod tests\s*\{/)[0];
const emittedTopics = contractSources.emittedTopicsIn(emitterSource);

const rustTypes: Record<string, EventFieldType> = {
  u64: 'u64',
  u32: 'u32',
  i128: 'i128',
  Address: 'address',
  String: 'string',
  bool: 'bool',
};

const fixtureValues: Record<EventFieldType, string | number | boolean> = {
  u64: '1',
  u32: 1,
  i128: '100',
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  string: 'contract event fixture',
  bool: true,
};

function toTopic(structName: string): string {
  if (structName === 'ContributionEvent') return 'contribution_receipt';
  return structName.replace(/[A-Z]/g, (letter, index) =>
    `${index === 0 ? '' : '_'}${letter.toLowerCase()}`,
  );
}

function buildContractFixtures(): Array<{
  topic: string;
  fields: Record<string, unknown>;
  fieldTypes: Record<string, EventFieldType>;
}> {
  const structs = [
    ...eventsSource.matchAll(
      /#\[contracttype\]\s*#\[derive\([^\]]+\)\]\s*pub struct (\w+)\s*\{([^}]+)\}/g,
    ),
  ];

  const fixtures = structs.map(([, structName, body]) => {
    const fields: Record<string, unknown> = {};
    const fieldTypes: Record<string, EventFieldType> = {};
    for (const [, field, rustType] of body.matchAll(
      /pub\s+([a-z_]+):\s*([A-Za-z0-9_]+),/g,
    )) {
      const schemaType = rustTypes[rustType];
      if (!schemaType) {
        throw new Error(`Unsupported event field type ${rustType} in ${structName}.${field}`);
      }
      fields[field] = fixtureValues[schemaType];
      fieldTypes[field] = schemaType;
    }
    return { topic: toTopic(structName), fields, fieldTypes };
  });

  fixtures.push({
    topic: 'contribution_due',
    fields: {
      group_id: fixtureValues.u64,
      member: fixtureValues.address,
      cycle: fixtureValues.u32,
      deadline: fixtureValues.u64,
      emitted_at: fixtureValues.u64,
    },
    fieldTypes: {
      group_id: 'u64',
      member: 'address',
      cycle: 'u32',
      deadline: 'u64',
      emitted_at: 'u64',
    },
  });
  return fixtures;
}

function matchesType(value: unknown, type: EventFieldType): boolean {
  switch (type) {
    case 'u64':
    case 'i128':
      return typeof value === 'string';
    case 'u32':
      return typeof value === 'number';
    case 'address':
    case 'string':
      return typeof value === 'string';
    case 'bool':
      return typeof value === 'boolean';
  }
}

describe('contract event schema contract', () => {
  it('validates a fixture for every Rust event against the shared schema', () => {
    const fixtures = buildContractFixtures();

    expect(fixtures.length).toBeGreaterThan(1);
    expect(emittedTopics.length).toBeGreaterThan(0);
    const fixtureTopics = new Set(fixtures.map(({ topic }) => topic));
    expect(fixtureTopics.size).toBe(fixtures.length);
    for (const topic of emittedTopics) {
      expect(fixtureTopics.has(topic)).toBe(true);
    }
    for (const fixture of fixtures) {
      const schema = eventSchema.events[fixture.topic];
      if (!schema) throw new Error(`Missing schema for contract event ${fixture.topic}`);
      expect(schema.topic).toBe(fixture.topic);
      expect(Object.keys(fixture.fields).sort()).toEqual(Object.keys(schema.fields).sort());
      expect(fixture.fieldTypes).toEqual(schema.fields);
      for (const [field, expectedType] of Object.entries(schema.fields)) {
        expect(matchesType(fixture.fields[field], expectedType)).toBe(true);
      }
    }
  });

  it('requires schema_version on every schema entry', () => {
    expect(contractSources.findMissingSchemaVersionFields(eventSchema)).toEqual([]);
  });

  it('requires every domain module to declare a *_SCHEMA_VERSION constant', () => {
    const sources = contractSources.loadDomainSources();
    expect(contractSources.findMissingSchemaVersionConstants(sources)).toEqual([]);
  });

  it('keeps domain-module topics and the shared schema in agreement', () => {
    const drift = contractSources.findTopicDrift(eventSchema, contractSources.loadDomainSources());
    expect(drift.missingFromSchema).toEqual([]);
    expect(drift.missingEmitter).toEqual([]);
    expect(drift.schemaTopicCount).toBeGreaterThan(0);
  });

  it('flags a schema entry without schema_version', () => {
    const schema: { events: Record<string, EventSchema> } = {
      events: { demo_event: { topic: 'demo_event', fields: { group_id: 'u64' } } },
    };
    expect(contractSources.findMissingSchemaVersionFields(schema)).toEqual(['demo_event']);
  });

  it('flags a domain module without a *_SCHEMA_VERSION constant', () => {
    const sources = [{ file: 'demo.rs', src: 'pub const DEMO: u32 = 1;' }];
    expect(contractSources.findMissingSchemaVersionConstants(sources)).toEqual(['demo.rs']);
  });

  it('reports topics that drift in either direction', () => {
    const schema: { events: Record<string, EventSchema> } = {
      events: { a: { topic: 'only_in_schema', fields: {} } },
    };
    const sources = [{ file: 'demo.rs', src: 'publish(("only_in_code"), 1);' }];
    expect(contractSources.findTopicDrift(schema, sources)).toEqual({
      missingFromSchema: ['only_in_code'],
      missingEmitter: ['only_in_schema'],
      schemaTopicCount: 1,
    });
  });
});
