import { prisma } from '../../prisma_client';
import { AnalyticsService } from '../../analytics_service';
import { logger } from '../../logger';

export class AnalyticsHandler {
  private analyticsService: AnalyticsService;

  constructor(dbClient: any = prisma) {
    this.analyticsService = new AnalyticsService(dbClient);
  }

  async execute(lookbackHours: number = 25): Promise<any> {
    try {
      const result = await this.analyticsService.resyncSorobanAnalytics({ lookbackHours });
      logger.info('Analytics resync completed', result);
      return result;
    } catch (error) {
      logger.error('Analytics resync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
