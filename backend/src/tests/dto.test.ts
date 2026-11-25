import { contractEventSchema, toContractEventDTO } from '../dto';

describe('toContractEventDTO', () => {
  const dbRow = {
    id: 'internal-cuid-1',
    contractId: 'CONTRACT1',
    eventType: 'GroupCreated',
    topics: ['group_created'],
    data: { groupId: 'g1' },
    txHash: 'tx1',
    ledgerSeq: 42,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    blockTime: new Date('2026-01-01T00:00:01.000Z'),
    createdAt: new Date('2026-01-01T00:00:02.000Z'),
  };

  it('maps public-facing fields', () => {
    expect(toContractEventDTO(dbRow)).toEqual({
      contractId: 'CONTRACT1',
      eventType: 'GroupCreated',
      topics: ['group_created'],
      data: { groupId: 'g1' },
      txHash: 'tx1',
      ledgerSeq: 42,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('does not leak internal-only DB fields', () => {
    const dto = toContractEventDTO(dbRow) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('blockTime');
  });

  it('preserves the exported schema descriptor for existing consumers', () => {
    expect(contractEventSchema).toEqual({
      contractId: 'string',
      eventType: 'string',
      topics: 'unknown',
      data: 'unknown',
      txHash: 'string',
      ledgerSeq: 'number',
      timestamp: 'string',
    });
  });

  it.each([
    ['missing contractId', { ...dbRow, contractId: undefined }],
    ['invalid eventType', { ...dbRow, eventType: 42 }],
    ['invalid ledgerSeq', { ...dbRow, ledgerSeq: '42' }],
    ['missing topics', { ...dbRow, topics: undefined }],
    ['invalid timestamp', { ...dbRow, timestamp: '2026-01-01T00:00:00.000Z' }],
    ['invalid Date', { ...dbRow, timestamp: new Date(Number.NaN) }],
  ])('rejects invalid records (%s)', (_label, record) => {
    expect(() => toContractEventDTO(record)).toThrow();
  });

  it('allows nullable JSON fields and unknown database columns', () => {
    const dto = toContractEventDTO({ ...dbRow, topics: null, data: null, extra: 'internal' });

    expect(dto.topics).toBeNull();
    expect(dto.data).toBeNull();
    expect(dto).not.toHaveProperty('extra');
  });
});
