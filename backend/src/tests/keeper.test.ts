import { KeeperJob } from '../jobs/keeper_job';
import { IStellarClient } from '../lib/stellar_client';

jest.mock('../metrics', () => ({
  registry: {
    registerMetric: jest.fn(),
    getMetricsAsJSON: jest.fn(() => []),
  },
}));

// Speed up backoff in tests by reducing timeout delays
jest.setTimeout(15000);

function makeContributionEvent(groupId: string, cycleNumber: number, member: string) {
  return { data: { group_id: groupId, cycle_number: cycleNumber, member } };
}

describe('KeeperJob.runOnce (with Dependency Injection)', () => {
  let mockStellarClient: jest.Mocked<IStellarClient>;
  let mockDb: any;

  beforeEach(() => {
    mockStellarClient = {
      executePayoutsBatch: jest.fn(),
    };
    mockDb = {
      contractEvent: {
        findMany: jest.fn(),
      },
    };
  });

  it('does nothing when no groups are due', async () => {
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([])  // contributions
      .mockResolvedValueOnce([]); // payouts
    const job = new KeeperJob('CCONTRACT', mockStellarClient, mockDb);
    await job.runOnce();
    expect(mockStellarClient.executePayoutsBatch).not.toHaveBeenCalled();
  });

  it('calls executePayoutsBatch on injected StellarClient for due groups', async () => {
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        makeContributionEvent('group-1', 1, 'GABC'),
        makeContributionEvent('group-1', 1, 'GDEF'),
      ])
      .mockResolvedValueOnce([]); // no payouts yet
    mockStellarClient.executePayoutsBatch.mockResolvedValueOnce();

    const job = new KeeperJob('CCONTRACT', mockStellarClient, mockDb);
    await job.runOnce();

    expect(mockStellarClient.executePayoutsBatch).toHaveBeenCalledTimes(1);
    expect(mockStellarClient.executePayoutsBatch).toHaveBeenCalledWith(['group-1'], 'CCONTRACT');
  });

  it('skips groups that already have PayoutExecuted', async () => {
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        makeContributionEvent('group-2', 1, 'GABC'),
        makeContributionEvent('group-2', 1, 'GDEF'),
      ])
      .mockResolvedValueOnce([{ data: { group_id: 'group-2', cycle_number: 1 } }]);

    const job = new KeeperJob('CCONTRACT', mockStellarClient, mockDb);
    await job.runOnce();
    expect(mockStellarClient.executePayoutsBatch).not.toHaveBeenCalled();
  });

  it('dead-letters a group after 3 consecutive failures and stops retrying', async () => {
    const contributions = [
      makeContributionEvent('group-3', 1, 'GABC'),
      makeContributionEvent('group-3', 1, 'GDEF'),
    ];

    mockStellarClient.executePayoutsBatch.mockRejectedValue(new Error('rpc error'));

    const job = new KeeperJob('CCONTRACT', mockStellarClient, mockDb);

    for (let i = 0; i < 3; i++) {
      mockDb.contractEvent.findMany
        .mockResolvedValueOnce(contributions)
        .mockResolvedValueOnce([]);
      await job.runOnce();
    }

    mockStellarClient.executePayoutsBatch.mockClear();

    // 4th run: group is dead-lettered, executePayoutsBatch must NOT be called
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce(contributions)
      .mockResolvedValueOnce([]);
    await job.runOnce();
    expect(mockStellarClient.executePayoutsBatch).not.toHaveBeenCalled();
  }, 15000);
});
