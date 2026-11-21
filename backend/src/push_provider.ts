import { logger } from './logger';

/**
 * Push Provider abstraction (Issue #1872)
 *
 * Single module that talks to push SDKs. Both notification services route
 * through this interface so provider selection and sending logic live in one
 * place. When credentials are missing the no-op provider is selected and a
 * single warning is logged.
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushProvider {
  readonly name: string;
  send(deviceToken: string, payload: PushPayload): Promise<string>;
  sendBatch(deviceTokens: string[], payload: PushPayload): Promise<string[]>;
  invalidateToken(deviceToken: string): Promise<void>;
}

export interface PushProviderConfig {
  firebase?: { projectId?: string; serviceAccount?: string };
  oneSignal?: { appId?: string; apiKey?: string };
}

export interface PushProviderLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function generateMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class FirebasePushProvider implements PushProvider {
  readonly name = 'firebase';

  constructor(
    private readonly projectId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed service account JSON varies by SDK version
    private readonly serviceAccount: Record<string, unknown>,
    private readonly log: PushProviderLogger = logger
  ) {}

  async send(deviceToken: string, payload: PushPayload): Promise<string> {
    // TODO: integrate Firebase Admin SDK when credentials are provisioned.
    this.log.info('Firebase message would be sent', { deviceToken, payload });
    return generateMessageId('firebase');
  }

  async sendBatch(deviceTokens: string[], payload: PushPayload): Promise<string[]> {
    return Promise.all(deviceTokens.map((token) => this.send(token, payload)));
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    this.log.info('Firebase token invalidated', { deviceToken });
  }
}

export class OneSignalPushProvider implements PushProvider {
  readonly name = 'onesignal';

  constructor(
    private readonly appId: string,
    private readonly apiKey: string,
    private readonly log: PushProviderLogger = logger
  ) {}

  async send(deviceToken: string, payload: PushPayload): Promise<string> {
    // TODO: integrate OneSignal REST API when credentials are provisioned.
    this.log.info('OneSignal message would be sent', { deviceToken, payload });
    return generateMessageId('onesignal');
  }

  async sendBatch(deviceTokens: string[], payload: PushPayload): Promise<string[]> {
    return Promise.all(deviceTokens.map((token) => this.send(token, payload)));
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    this.log.info('OneSignal token invalidated', { deviceToken });
  }
}

export class NoopPushProvider implements PushProvider {
  readonly name = 'noop';

  constructor(private readonly log: PushProviderLogger = logger) {}

  async send(deviceToken: string, payload: PushPayload): Promise<string> {
    this.log.debug('Noop push provider: message dropped', { deviceToken, payload });
    return 'no-provider';
  }

  async sendBatch(deviceTokens: string[], payload: PushPayload): Promise<string[]> {
    return deviceTokens.map(() => 'no-provider');
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    this.log.debug('Noop push provider: token invalidation ignored', { deviceToken });
  }
}

/**
 * Select the active push provider from configuration at startup.
 * Logs a single warning when no credentials are present.
 */
export function createPushProvider(
  config: PushProviderConfig,
  log: PushProviderLogger = logger
): PushProvider {
  const firebase = config.firebase;
  if (firebase?.projectId && firebase.serviceAccount) {
    try {
      const serviceAccount = JSON.parse(firebase.serviceAccount);
      return new FirebasePushProvider(firebase.projectId, serviceAccount, log);
    } catch (e) {
      log.error('Failed to parse FIREBASE_SERVICE_ACCOUNT', e);
    }
  }

  const oneSignal = config.oneSignal;
  if (oneSignal?.appId && oneSignal.apiKey) {
    return new OneSignalPushProvider(oneSignal.appId, oneSignal.apiKey, log);
  }

  log.warn('No push provider credentials configured; using no-op push provider');
  return new NoopPushProvider(log);
}
