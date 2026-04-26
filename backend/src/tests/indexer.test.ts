import { StellarEventIndexer } from '../stellar_event_indexer';

const sampleHorizonRecord = {
  id: 'evt-0',
  paging_token: '1234567890',
  type: 'contract_event',
  type_i: 42,
  ledger: 1532,
  created_at: '2026-04-26T12:00:00Z',
  transaction_hash: 'abcdef1234567890',
  source_account: 'GABC...XYZ',
  contract_id: 'C12345',
  topic: 'balance_update',
  data: { amount: 100 },
};

function createFakeCollection(initialData = []) {
  const data = [...initialData];

  return {
    createIndex: async () => {},
    find: (filter: any) => {
      const matches = data.filter((doc) => {
        for (const key of Object.keys(filter)) {
          const value = filter[key];
          if (key === 'createdAt') {
            if (value.$gte && doc.createdAt < value.$gte) return false;
            if (value.$lte && doc.createdAt > value.$lte) return false;
          } else if (doc[key] !== value) {
            return false;
          }
        }
        return true;
      });
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              toArray: async () => matches,
            }),
          }),
        }),
      };
    },
    countDocuments: async (filter: any) => {
      const matches = data.filter((doc) => {
        for (const key of Object.keys(filter)) {
          const value = filter[key];
          if (key === 'createdAt') {
            if (value.$gte && doc.createdAt < value.$gte) return false;
            if (value.$lte && doc.createdAt > value.$lte) return false;
          } else if (doc[key] !== value) {
            return false;
          }
        }
        return true;
      });
      return matches.length;
    },
    findOne: async (filter: any) => data.find((doc) => doc.id === filter.id) ?? null,
    bulkWrite: async (ops: any[]) => {
      let upsertedCount = 0;
      for (const op of ops) {
        const { filter, update } = op.updateOne;
        const existing = data.find((doc) => doc.pagingToken === filter.pagingToken);
        if (!existing) {
          data.push(update.$setOnInsert);
          upsertedCount += 1;
        }
      }
      return { upsertedCount, matchedCount: ops.length - upsertedCount };
    },
  };
}

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`❌ ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${label}`);
  }
}

async function runTests() {
  console.log('🧪 Running Stellar Event Indexer Tests...');

  const indexer = new StellarEventIndexer({ horizonUrl: 'https://horizon-testnet.stellar.org' });
  const parsed = (indexer as any).toContractEvent(sampleHorizonRecord);

  assert(parsed.id === 'evt-0', 'parses id from Horizon event');
  assert(parsed.contractId === 'C12345', 'parses contractId from Horizon event');
  assert(parsed.topic === 'balance_update', 'parses topic from Horizon event');
  assert(parsed.createdAt instanceof Date, 'createdAt is converted to Date');

  const filter = (indexer as any).buildFilter({ contractId: 'C12345', type: 'contract_event', from: '2026-04-26', to: '2026-04-27' });
  assert(filter.contractId === 'C12345', 'builds contractId filter');
  assert(filter.type === 'contract_event', 'builds type filter');
  assert(filter.createdAt.$gte instanceof Date && filter.createdAt.$lte instanceof Date, 'builds date range filter');

  const fakeCollection = createFakeCollection([
    { ...parsed },
    {
      id: 'evt-1',
      pagingToken: '1234567891',
      type: 'contract_event',
      ledger: 1533,
      createdAt: new Date('2026-04-27T10:00:00Z'),
      transactionHash: 'deadbeef',
      sourceAccount: 'GXYZ...ABC',
      contractId: 'C12345',
      topic: 'balance_update',
      data: { amount: 200 },
      raw: {},
    },
  ]);

  (indexer as any).collection = fakeCollection;
  const result = await indexer.queryEvents({ contractId: 'C12345', limit: 1, page: 1 });
  assert(result.events.length === 1, 'queryEvents returns paginated event list');
  assert(result.total === 2, 'queryEvents returns total count');

  const event = await indexer.getEventById('evt-1');
  assert(event?.id === 'evt-1', 'getEventById returns the correct event');

  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ _embedded: { records: [sampleHorizonRecord] } }),
  });
  (global as any).fetch = fakeFetch;
  const fakeCollectionForIndex = createFakeCollection([]);
  (indexer as any).collection = fakeCollectionForIndex;
  const imported = await indexer.indexNewEvents();
  assert(imported.imported === 1, 'indexNewEvents imports new Horizon events');
  assert(fakeCollectionForIndex.countDocuments({}) === 1, 'collection contains the imported event');

  if (process.exitCode === 1) {
    console.error('One or more tests failed.');
  } else {
    console.log('ALL INDEXER TESTS PASSED! 🎉');
  }
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exitCode = 1;
});
