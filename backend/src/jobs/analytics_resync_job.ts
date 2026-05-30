import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../analytics_service';
import { logger } from '../logger';

const prisma = new PrismaClient();
const analyticsService = new AnalyticsService(prisma);

export function startAnalyticsResyncJob(schedule = '0 * * * *'): cron.ScheduledTask {
  const task = cron.schedule(schedule, async () => {
    try {
      const result = await analyticsService.resyncSorobanAnalytics({ lookbackHours: 25 });
      logger.info('Analytics resync job completed', result);
    } catch (error) {
      logger.error('Analytics resync job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  task.start();
  logger.info('Analytics resync job started', { schedule });
  return task;
}
