const mockPrisma = {
  indexedTransaction: {
    findFirst: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../generated/prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { HorizonIndexer } from '../services/indexer';

const flush = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

function txRecord(overrides: Record<string, unknown> = {}) {
  return {
    hash: 'tx1',
    ledger: 100,
    paging_token: 'p1',
    source_account: 'GABC',
    fee_charged: '100',
    operation_count: 1,
    ...overrides,
  };
}

describe('HorizonIndexer resiliency', () => {
  let fetchMock: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('resumes from the last indexed ledger checkpoint on restart', async () => {
    mockPrisma.indexedTransaction.findFirst.mockResolvedValue({
      pagingToken: 'checkpoint-42',
      ledgerSeq: 42,
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records: [] } }) });

    const indexer = new HorizonIndexer('https://horizon.test', 'CONTRACT', { pollIntervalMs: 10 });
    await indexer.start();
    await flush();
    await indexer.stop();

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('cursor')).toBe('checkpoint-42');
  });

  it('starts from the chain tip when no prior checkpoint exists', async () => {
    mockPrisma.indexedTransaction.findFirst.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records: [] } }) });

    const indexer = new HorizonIndexer('https://horizon.test', 'CONTRACT', { pollIntervalMs: 10 });
    await indexer.start();
    await flush();
    await indexer.stop();

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('cursor')).toBe('now');
  });

  it('recovers from a Horizon connection loss without crashing the poll loop', async () => {
    mockPrisma.indexedTransaction.findFirst.mockResolvedValue(null);
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records: [] } }) });

    const indexer = new HorizonIndexer('https://horizon.test', 'CONTRACT', { pollIntervalMs: 10 });
    await indexer.start();
    await flush(60);
    await indexer.stop();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[HorizonIndexer] Poll error:',
      expect.any(Error)
    );
    // The loop retried after the connection error instead of stopping.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('handles duplicate/out-of-order events idempotently via upsert', async () => {
    mockPrisma.indexedTransaction.findFirst.mockResolvedValue(null);
    const duplicateRecord = txRecord();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _embedded: { records: [duplicateRecord, duplicateRecord] } }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ _embedded: { records: [] } }) });

    const indexer = new HorizonIndexer('https://horizon.test', 'CONTRACT', { pollIntervalMs: 10 });
    await indexer.start();
    await flush();
    await indexer.stop();

    expect(mockPrisma.indexedTransaction.upsert).toHaveBeenCalledTimes(2);
    for (const call of mockPrisma.indexedTransaction.upsert.mock.calls) {
      expect(call[0].where).toEqual({ txHash: 'tx1' });
      expect(call[0].update).toEqual({});
    }
  });
});
