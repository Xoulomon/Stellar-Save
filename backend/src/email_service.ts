import { withRetry } from '@stellar-save/shared-utils';

import { emailRetryPolicy } from './lib/retry_policies';
import { logger } from './logger';
import {
  PushProvider,
  ConsolePushProvider,
} from './push_provider';

/**
 * Abstraction over an email transport. Implementations are responsible for
 * actually dispatching an email; retry semantics are handled by EmailService.
 */
export interface EmailProvider {
  send(email: string, subject: string, body: string): Promise<void>;
}

/**
 * Default email provider that logs the message. Kept as the backwards
 * compatible default so existing callers keep working unchanged.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(email: string, subject: string, body: string): Promise<void> {
    logger.info(`[EmailService] Sending "${subject}" to ${email}: ${body}`);
  }
}

export interface EmailServiceDependencies {
  emailProvider?: EmailProvider;
  pushProvider?: PushProvider;
}

export class EmailService {
  private emailProvider: EmailProvider;
  private pushProvider: PushProvider;

  constructor(deps: EmailServiceDependencies = {}) {
    this.emailProvider = deps.emailProvider ?? new ConsoleEmailProvider();
    this.pushProvider = deps.pushProvider ?? new ConsolePushProvider();
  }

  /**
   * Replace the email provider at runtime (e.g. for tests or configuration).
   */
  setEmailProvider(provider: EmailProvider): void {
    this.emailProvider = provider;
  }

  /**
   * Replace the push provider at runtime (e.g. for tests or configuration).
   */
  setPushProvider(provider: PushProvider): void {
    this.pushProvider = provider;
  }

  getEmailProvider(): EmailProvider {
    return this.emailProvider;
  }

  getPushProvider(): PushProvider {
    return this.pushProvider;
  }

  async sendExportEmail(email: string, fileUrl: string): Promise<void> {
    logger.info(`[EmailService] Sending export download link to ${email}: ${fileUrl}`);
    await withRetry(async () => {
      await this.emailProvider.send(
        email,
        'Your export is ready',
        `Download your export here: ${fileUrl}`,
      );
    }, emailRetryPolicy);
  }

  async sendPushNotification(
    recipient: string,
    title: string,
    body: string,
  ): Promise<void> {
    logger.info(`[EmailService] Sending push notification to ${recipient}: ${title}`);
    await withRetry(async () => {
      await this.pushProvider.send(recipient, title, body);
    }, emailRetryPolicy);
  }
}