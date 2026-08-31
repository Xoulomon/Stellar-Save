import { KeeperHandler } from './keeper.handler';
import { IStellarClient } from '../../lib/stellar_client';

describe('KeeperHandler', () => {
  let mockDb: any;
  let mockStellarClient: jest.Mocked<IStellarClient>;

  beforeEach(() => {
    mockDb = {
      contractEvent: {
        findMany: jest.fn(),
      },
    };

    mockStellarClient = {
      executePayoutsBatch: jest.fn(),
    } as any;
  });

  it('should find groups ready for payout', async () => {
    const contractId = 'test-contract';
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-1',
          },
        },
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-2',
          },
        },
      ])
      .mockResolvedValueOnce([]); // No payouts yet

    mockStellarClient.executePayoutsBatch.mockResolvedValue(undefined);

    const handler = new KeeperHandler(contractId, mockStellarClient, mockDb);
    await handler.execute();

    expect(mockStellarClient.executePayoutsBatch).toHaveBeenCalledWith(
      ['group-1'],
      contractId,
    );
  });

  it('should skip groups that already have payouts', async () => {
    const contractId = 'test-contract';
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-1',
          },
        },
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-2',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
          },
        },
      ]);

    const handler = new KeeperHandler(contractId, mockStellarClient, mockDb);
    await handler.execute();

    expect(mockStellarClient.executePayoutsBatch).not.toHaveBeenCalled();
  });

  it('should require at least 2 members to proceed', async () => {
    const contractId = 'test-contract';
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-1',
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const handler = new KeeperHandler(contractId, mockStellarClient, mockDb);
    await handler.execute();

    expect(mockStellarClient.executePayoutsBatch).not.toHaveBeenCalled();
  });

  it('should handle execution errors gracefully', async () => {
    const contractId = 'test-contract';
    mockDb.contractEvent.findMany
      .mockResolvedValueOnce([
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-1',
          },
        },
        {
          data: {
            group_id: 'group-1',
            cycle_number: 1,
            member: 'member-2',
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const error = new Error('Execution failed');
    mockStellarClient.executePayoutsBatch.mockRejectedValue(error);

    const handler = new KeeperHandler(contractId, mockStellarClient, mockDb);
    await expect(handler.execute()).rejects.toThrow(Error);

    expect(mockStellarClient.executePayoutsBatch).toHaveBeenCalled();
  });
});
