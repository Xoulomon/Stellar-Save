import { AnalyticsHandler } from './analytics.handler';
import { AnalyticsService } from '../../analytics_service';

jest.mock('../../analytics_service');

describe('AnalyticsHandler', () => {
  let mockDb: any;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockAnalyticsService = new AnalyticsService(mockDb) as any;
  });

  it('should execute analytics resync with default lookback', async () => {
    const mockResult = { synced: 100, updated: 50 };
    (AnalyticsService as jest.MockedClass<typeof AnalyticsService>).prototype
      .resyncSorobanAnalytics = jest.fn().mockResolvedValue(mockResult);

    const handler = new AnalyticsHandler(mockDb);
    const result = await handler.execute();

    expect(result).toEqual(mockResult);
  });

  it('should execute analytics resync with custom lookback', async () => {
    const mockResult = { synced: 50, updated: 25 };
    (AnalyticsService as jest.MockedClass<typeof AnalyticsService>).prototype
      .resyncSorobanAnalytics = jest.fn().mockResolvedValue(mockResult);

    const handler = new AnalyticsHandler(mockDb);
    const result = await handler.execute(10);

    expect(result).toEqual(mockResult);
  });

  it('should propagate errors from analytics service', async () => {
    const error = new Error('Analytics service error');
    (AnalyticsService as jest.MockedClass<typeof AnalyticsService>).prototype
      .resyncSorobanAnalytics = jest.fn().mockRejectedValue(error);

    const handler = new AnalyticsHandler(mockDb);
    await expect(handler.execute()).rejects.toThrow('Analytics service error');
  });
});
