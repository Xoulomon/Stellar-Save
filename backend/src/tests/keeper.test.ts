import { KeeperJob } from '../jobs/keeper_job';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

jest.mock('../prisma_client', () => ({
  prisma: {
    contractEvent: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../metrics', () => ({
  registry: {
    registerMetric: jest.fn(),
    getMetricsAsJSON: jest.fn(() => []),
    // Stub enough for prom-client Counter/Gauge registration
  },
}));

// Speed up backoff in tests by reducing timeout delays
jest.setTimeout(15000);

const { prisma } = require('../prisma_client');

function makeContributionEvent(groupId: string, cycleNumber: number, member: string) {
  return { data: { group_id: groupId, cycle_number: cycleNumber, member } };
}

beforeEach(() => {
  mockFetch.mockReset();
  jest.clearAllMocks();
});

describe('KeeperJob.runOnce', () => {
  it('does nothing when no groups are due', async () => {
    prisma.contractEvent.findMany
      .mockResolvedValueOnce([])  // contributions
      .mockResolvedValueOnce([]); // payouts
    const job = new KeeperJob('CCONTRACT', 'https://soroban.example.com');
    await job.runOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls executePayoutsBatch for due groups', async () => {
    prisma.contractEvent.findMany
      .mockResolvedValueOnce([
        makeContributionEvent('group-1', 1, 'GABC'),
        makeContributionEvent('group-1', 1, 'GDEF'),
      ])
      .mockResolvedValueOnce([]); // no payouts yet
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: {} }) } as any);
    const job = new KeeperJob('CCONTRACT', 'https://soroban.example.com');
    await job.runOnce();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://soroban.example.com',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('skips groups that already have PayoutExecuted', async () => {
    prisma.contractEvent.findMany
      .mockResolvedValueOnce([
        makeContributionEvent('group-2', 1, 'GABC'),
        makeContributionEvent('group-2', 1, 'GDEF'),
      ])
      .mockResolvedValueOnce([{ data: { group_id: 'group-2', cycle_number: 1 } }]);
    const job = new KeeperJob('CCONTRACT', 'https://soroban.example.com');
    await job.runOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('dead-letters a group after 3 consecutive failures and stops retrying', async () => {
    const contributions = [
      makeContributionEvent('group-3', 1, 'GABC'),
      makeContributionEvent('group-3', 1, 'GDEF'),
    ];

    // All fetches reject immediately
    mockFetch.mockRejectedValue(new Error('rpc error'));

    const job = new KeeperJob('CCONTRACT', 'https://soroban.example.com');

    // Each runOnce increments retryMap; backoff retries happen but we allow them
    for (let i = 0; i < 3; i++) {
      prisma.contractEvent.findMany
        .mockResolvedValueOnce(contributions)
        .mockResolvedValueOnce([]);
      await job.runOnce();
      mockFetch.mockClear();
    }

    // 4th run: group is dead-lettered, fetch must NOT be called
    prisma.contractEvent.findMany
      .mockResolvedValueOnce(contributions)
      .mockResolvedValueOnce([]);
    await job.runOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  }, 15000);
});
