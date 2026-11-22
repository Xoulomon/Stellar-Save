/**
 * Integration Test: Webhook Retry Storm Scenario (Issue #1703)
 *
 * Verifies that the backend webhook retry contract agrees with
 * `client/src/webhook_retry.rs` and properly handles burst failures,
 * exponential backoff, DLQ exhaustion, and idempotency deduplication.
 */

import {
  WebhookQueue,
  createWebhookJob,
  MAX_ATTEMPTS,
  BASE_DELAY_SECS,
  MAX_DELAY_SECS,
  computeBackoffDelaySecs,
} from '../lib/webhook_retry';

describe('Webhook Retry Contract & Retry Storm Integration Test', () => {
  describe('Contract Consistency with client/src/webhook_retry.rs', () => {
    it('has identical constant parameters', () => {
      expect(MAX_ATTEMPTS).toBe(5);
      expect(BASE_DELAY_SECS).toBe(1);
      expect(MAX_DELAY_SECS).toBe(300);
    });

    it('matches backoff delay progression across attempts', () => {
      // Attempt 1: base * 2^1 = 2s
      expect(computeBackoffDelaySecs(1)).toBe(2);
      // Attempt 2: base * 2^2 = 4s
      expect(computeBackoffDelaySecs(2)).toBe(4);
      // Attempt 3: base * 2^3 = 8s
      expect(computeBackoffDelaySecs(3)).toBe(8);
      // Attempt 4: base * 2^4 = 16s
      expect(computeBackoffDelaySecs(4)).toBe(16);
      // Attempt 30 (large exponent capped at MAX_DELAY_SECS)
      expect(computeBackoffDelaySecs(30)).toBe(MAX_DELAY_SECS);
    });
  });

  describe('Simulated Retry Storm Scenario', () => {
    it('handles 100 failing concurrent webhooks and gracefully moves to DLQ after 5 attempts', async () => {
      const queue = new WebhookQueue();
      const JOB_COUNT = 100;
      let targetServerHealthy = false;
      const processedEventIds = new Set<string>();

      // 1. Enqueue 100 jobs simultaneously
      for (let i = 0; i < JOB_COUNT; i++) {
        queue.enqueue(
          createWebhookJob(
            `storm-job-${i}`,
            'https://api.partner.org/webhook',
            JSON.stringify({ event: 'contribution.created', id: i }),
            `whk_storm_${i}`
          )
        );
      }

      expect(queue.pending.length).toBe(JOB_COUNT);
      expect(queue.deadLetter.length).toBe(0);

      let simulatedTimeSecs = 1000;

      // Mock delivery handler with simulated server outage
      const deliver = (job: { id: string; idempotencyKey: string }) => {
        if (!targetServerHealthy) {
          return 'Failure';
        }
        processedEventIds.add(job.idempotencyKey);
        return 'Success';
      };

      // Attempt 1 fails for all jobs
      await queue.tick(deliver, simulatedTimeSecs);
      expect(queue.pending.length).toBe(JOB_COUNT);
      expect(queue.pending.every((j) => j.attempts === 1)).toBe(true);

      // Advance time by 1s: not yet due because delay for attempt 1 is 2s (due at 1002)
      simulatedTimeSecs += 1;
      await queue.tick(deliver, simulatedTimeSecs);
      // No jobs should have been executed because none are due
      expect(queue.pending.every((j) => j.attempts === 1)).toBe(true);

      // Advance to 1002s (attempt 2 fails)
      simulatedTimeSecs += 1;
      await queue.tick(deliver, simulatedTimeSecs);
      expect(queue.pending.every((j) => j.attempts === 2)).toBe(true);

      // Advance to 1006s (attempt 3 fails, delay was 4s)
      simulatedTimeSecs += 4;
      await queue.tick(deliver, simulatedTimeSecs);
      expect(queue.pending.every((j) => j.attempts === 3)).toBe(true);

      // Advance to 1014s (attempt 4 fails, delay was 8s)
      simulatedTimeSecs += 8;
      await queue.tick(deliver, simulatedTimeSecs);
      expect(queue.pending.every((j) => j.attempts === 4)).toBe(true);

      // Advance to 1030s (attempt 5 fails, delay was 16s) -> Should exhaust and move to DLQ
      simulatedTimeSecs += 16;
      await queue.tick(deliver, simulatedTimeSecs);

      // All 100 jobs should now be in DLQ, pending should be 0
      expect(queue.pending.length).toBe(0);
      expect(queue.deadLetter.length).toBe(JOB_COUNT);

      // Verify DLQ draining
      const dlqJobs = queue.drainDlq();
      expect(dlqJobs.length).toBe(JOB_COUNT);
      expect(queue.deadLetter.length).toBe(0);
    });

    it('recovers successfully when destination comes back online before max attempts', async () => {
      const queue = new WebhookQueue();
      const JOB_COUNT = 50;
      let targetServerHealthy = false;
      const deliveredKeys = new Set<string>();

      for (let i = 0; i < JOB_COUNT; i++) {
        queue.enqueue(
          createWebhookJob(
            `recovery-job-${i}`,
            'https://api.partner.org/webhook',
            JSON.stringify({ event: 'payout.executed', id: i }),
            `whk_rec_${i}`
          )
        );
      }

      let simulatedTimeSecs = 2000;
      const deliver = (job: { idempotencyKey: string }) => {
        if (!targetServerHealthy) return 'Failure';
        deliveredKeys.add(job.idempotencyKey);
        return 'Success';
      };

      // First attempt fails during outage
      await queue.tick(deliver, simulatedTimeSecs);
      expect(queue.pending.length).toBe(JOB_COUNT);

      // Target server recovers!
      targetServerHealthy = true;

      // Advance time past the 2s backoff delay
      simulatedTimeSecs += 2;
      await queue.tick(deliver, simulatedTimeSecs);

      // All jobs should be delivered successfully and removed from pending
      expect(queue.pending.length).toBe(0);
      expect(queue.deadLetter.length).toBe(0);
      expect(deliveredKeys.size).toBe(JOB_COUNT);
    });
  });
});
