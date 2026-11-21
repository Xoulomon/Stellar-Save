import { AnalyticsAggregator } from '../analytics_aggregator';
import { createPrismaMock } from '../../tests/helpers/prismaMock';

jest.mock('../redis', () => ({
  delPattern: jest.fn(),
}));

/**
 * `AnalyticsAggregator.aggregatePlatformMetrics` / `aggregateUserMetrics` /
 * `aggregateGroupMetrics` are private, so they're exercised here through the
 * public `runAggregation()` entry point, asserting on the upsert calls each
 * one makes against a mocked Prisma client.
 *
 * Hand-calculated expectations for the fixed event set below:
 *   - platform: 2 unique users, 1 unique group, 2 contributions (150 total),
 *     1 payout (30 total), 1 completed group out of 1 created (100% success)
 *   - u1: 1 contribution (100), 1 payout received (30), 1 page view
 *   - u2: 1 contribution (50)
 *   - g1: 2 members, 2 contributions (150), 1 payout (30), 75 avg contribution
 */
const events = [
  {
    id: '1',
    userId: 'u1',
    groupId: 'g1',
    sessionId: 's1',
    eventType: 'transaction',
    eventData: { type: 'contribution', amount: 100 },
  },
  {
    id: '2',
    userId: 'u2',
    groupId: 'g1',
    sessionId: 's2',
    eventType: 'transaction',
    eventData: { type: 'contribution', amount: 50 },
  },
  {
    id: '3',
    userId: 'u1',
    groupId: 'g1',
    sessionId: 's1',
    eventType: 'transaction',
    eventData: { type: 'payout', amount: 30 },
  },
  {
    id: '4',
    userId: 'u1',
    groupId: null,
    sessionId: 's1',
    eventType: 'page_view',
    eventData: {},
  },
  {
    id: '5',
    userId: null,
    groupId: 'g1',
    sessionId: null,
    eventType: 'group_created',
    eventData: {},
  },
  {
    id: '6',
    userId: null,
    groupId: 'g1',
    sessionId: null,
    eventType: 'group_completed',
    eventData: {},
  },
];

describe('AnalyticsAggregator', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createPrismaMock();
    mockDb.analyticsEvent.findMany.mockResolvedValue(events);
  });

  it('creates platform metrics with the correctly computed aggregates', async () => {
    const aggregator = new AnalyticsAggregator(mockDb);
    await aggregator.runAggregation();

    expect(mockDb.platformMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalUsers: 2,
        activeUsers: 2,
        totalGroups: 1,
        activeGroups: 0,
        totalContributions: 2,
        totalContributionAmount: 150,
        totalPayouts: 1,
        totalPayoutAmount: 30,
        averageGroupSize: 2,
        successRate: 100,
        totalTransactions: 3,
        uniqueWallets: 2,
      }),
    });
  });

  it('creates per-user metrics for every user with events', async () => {
    const aggregator = new AnalyticsAggregator(mockDb);
    await aggregator.runAggregation();

    expect(mockDb.userMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        totalContributions: 1,
        totalContributionAmount: 100,
        totalPayoutsReceived: 30,
        pageViews: 1,
        sessionsCount: 1,
        interactionCount: 3,
      }),
    });
    expect(mockDb.userMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u2',
        totalContributions: 1,
        totalContributionAmount: 50,
        totalPayoutsReceived: 0,
        pageViews: 0,
        interactionCount: 1,
      }),
    });
  });

  it('creates per-group metrics with member count and payout totals', async () => {
    const aggregator = new AnalyticsAggregator(mockDb);
    await aggregator.runAggregation();

    expect(mockDb.groupMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: 'g1',
        memberCount: 2,
        totalContributions: 2,
        totalContributionAmount: 150,
        totalPayoutsDistributed: 30,
        successRate: 100,
        averageContributionSize: 75,
      }),
    });
  });

  it('updates existing metrics instead of creating duplicates when a row already exists for the day', async () => {
    mockDb.platformMetrics.findFirst.mockResolvedValue({ id: 'existing-platform-metrics' });

    const aggregator = new AnalyticsAggregator(mockDb);
    await aggregator.runAggregation();

    expect(mockDb.platformMetrics.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-platform-metrics' } })
    );
    expect(mockDb.platformMetrics.create).not.toHaveBeenCalled();
  });

  it('does not throw when the database query fails', async () => {
    mockDb.analyticsEvent.findMany.mockRejectedValue(new Error('db unavailable'));

    const aggregator = new AnalyticsAggregator(mockDb);
    await expect(aggregator.runAggregation()).resolves.toBeUndefined();
  });

  it('clears the related cache patterns after a successful run', async () => {
    const redis = require('../redis');
    const aggregator = new AnalyticsAggregator(mockDb);
    await aggregator.runAggregation();

    expect(redis.delPattern).toHaveBeenCalledWith('platform_stats:*');
    expect(redis.delPattern).toHaveBeenCalledWith('platform_trends:*');
    expect(redis.delPattern).toHaveBeenCalledWith('user_stats:*');
    expect(redis.delPattern).toHaveBeenCalledWith('group_stats:*');
  });
});
