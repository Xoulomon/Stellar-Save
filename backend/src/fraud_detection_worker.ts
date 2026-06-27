import { fraudDetectionService } from './fraud_detection_service';
import { logger } from './logger';

export class FraudDetectionWorker {
  private intervalId?: NodeJS.Timer;
  private readonly scanIntervalMinutes = parseInt(process.env.FRAUD_SCAN_INTERVAL_MINUTES || '60', 10);

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

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Fraud detection worker stopped');
    }
  }
}

export const fraudDetectionWorker = new FraudDetectionWorker();
