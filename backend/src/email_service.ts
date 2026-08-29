import { logger } from './logger';
export class EmailService {
  async sendExportEmail(email: string, fileUrl: string): Promise<void> {
    logger.info(`[EmailService] Sending export download link to ${email}: ${fileUrl}`);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
