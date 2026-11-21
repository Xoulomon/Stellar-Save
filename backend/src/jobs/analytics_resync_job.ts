import cron from 'node-cron';

import { logger } from '../logger';
import { prisma } from '../prisma_client';
import { AnalyticsHandler } from './handlers/analytics.handler';
import { jobRetryPolicy } from '../lib/retry_policies';

let inFlight = false;

export function startAnalyticsResyncJob(schedule = '0 * * * *'): cron.ScheduledTask {
  const handler = new AnalyticsHandler(prisma);

  const task = cron.schedule(schedule, async () => {
    if (inFlight) {
      logger.warn('Analytics resync job skipped: previous run still in flight');
      return;
    }

    inFlight = true;
    try {
      await jobRetryPolicy.execute(() => handler.execute(25));
    } catch (error) {
      logger.error('Analytics resync job failed after retries', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight = false;
    }
  });

  task.start();
  logger.info('Analytics resync job started', { schedule });
  return task;
}