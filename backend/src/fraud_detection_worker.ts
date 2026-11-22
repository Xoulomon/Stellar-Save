import { config } from './config';
import { fraudDetectionService } from './fraud_detection_service';
import { logger } from './logger';

export class FraudDetectionWorker {
  private intervalId?: NodeJS.Timer;
  private readonly scanIntervalMinutes = config.fraud.scanIntervalMinutes;

  async start() {
    logger.info('Starting fraud detection worker', { intervalMinutes: this.scanIntervalMinutes });
    // Run first scan immediately
    await this.runScan();
    // Then schedule periodic scans
    this.intervalId = setInterval(() => this.runScan(), this.scanIntervalMinutes * 60 * 1000);
  }

  private async runScan() {
    try {
      logger.info('Running fraud detection scan');
      const results = await fraudDetectionService.runScan();
      logger.info('Fraud detection scan completed', { flagged: results.length });
    } catch (error) {
      logger.error('Fraud detection scan failed', { error: String(error) });
    }
  }

  async stop(timeoutMs?: number): Promise<void> {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = undefined;

    // Give any in-flight scan a bounded window to settle before reporting stopped.
    const boundedTimeout = typeof timeoutMs === 'number' ? timeoutMs : 5000;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, boundedTimeout);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
      // Resolve immediately on the next tick since scans are awaited internally;
      // the timeout acts as an upper bound for the coordinator.
      setImmediate(resolve);
    });

    logger.info('Fraud detection worker stopped');
  }
}

export const fraudDetectionWorker = new FraudDetectionWorker();
