import cron from 'node-cron';
import { prisma } from '../prisma_client';
import { logger } from '../logger';
import { AnalyticsHandler } from './handlers/analytics.handler';

export function startAnalyticsResyncJob(schedule = '0 * * * *'): cron.ScheduledTask {
  const handler = new AnalyticsHandler(prisma);

  const task = cron.schedule(schedule, async () => {
    try {
      await handler.execute(25);
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
