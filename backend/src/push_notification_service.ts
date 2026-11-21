import https from 'https';

import jwt from 'jsonwebtoken';

import { config } from './config';
import { deviceTokenService } from './device_token_service';
import { logger } from './logger';

/**
 * Unified push provider interface (Issue #1872).
 * Every push SDK call must go through an implementation of this interface.
 */
export interface PushProvider {
  send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string>;
  sendBatch(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string[]>;
  invalidateToken(deviceToken: string): Promise<void>;
}

/**
 * Backwards-compatible alias for the previous provider interface name.
 */
export type PushNotificationProvider = PushProvider;

/**
 * Firebase Cloud Messaging (FCM) Provider
 */
export class FirebasePushProvider implements PushProvider {
  private projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firebase service account is parsed from raw JSON; typed by Firebase Admin SDK not yet integrated
  private serviceAccount: Record<string, unknown>;

  constructor(projectId: string, serviceAccountJson: string) {
    this.projectId = projectId;
    try {
      this.serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('Invalid Firebase service account JSON');
    }
  }

  async send(
    deviceToken: string,
    title: string,
    body: string,
    _data?: Record<string, string>
  ): Promise<string> {
    try {
      // TODO: integrate Firebase Admin SDK when credentials are provisioned.
      logger.info('Firebase notification prepared', {
        deviceToken: deviceToken.substring(0, 20) + '...',
        title,
        body,
      });

      // Mock response for development
      return `fcm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      logger.error('Firebase send failed', { error: String(error) });
      throw error;
    }
  }

  async sendBatch(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string[]> {
    return Promise.all(deviceTokens.map((token) => this.send(token, title, body, data)));
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    await deviceTokenService.removeToken(deviceToken);
  }
}

/**
 * Apple Push Notification service (APNs) Provider
 * Uses HTTP/2 + JWT authentication
 */
export class ApnsProvider implements PushProvider {
  private keyId: string;
  private teamId: string;
  private privateKey: string;
  private bundleId: string;
  private production: boolean;

  constructor(
    keyId: string,
    teamId: string,
    privateKey: string,
    bundleId: string,
    production = false
  ) {
    this.keyId = keyId;
    this.teamId = teamId;
    this.privateKey = privateKey;
    this.bundleId = bundleId;
    this.production = production;
  }

  private getJwtToken(): string {
    return jwt.sign({}, this.privateKey, {
      algorithm: 'ES256',
      keyid: this.keyId,
      issuer: this.teamId,
      expiresIn: 3600,
    });
  }

  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string> {
    const host = this.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const payload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
      ...(data || {}),
    });
    const token = this.getJwtToken();

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: host,
        port: 443,
        path: `/3/device/${deviceToken}`,
        method: 'POST',
        headers: {
          'apns-topic': this.bundleId,
          authorization: `bearer ${token}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve((res.headers['apns-id'] as string) || 'apns-ok');
          } else {
            const err = new Error(`APNs error: ${responseBody}`) as Error & { statusCode?: number };
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async sendBatch(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string[]> {
    return Promise.all(deviceTokens.map((token) => this.send(token, title, body, data)));
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    await deviceTokenService.removeToken(deviceToken);
  }
}

/**
 * OneSignal Provider
 */
export class OneSignalPushProvider implements PushProvider {
  private appId: string;
  private apiKey: string;
  private baseUrl: string = 'https://onesignal.com/api/v1';

  constructor(appId: string, apiKey: string) {
    this.appId = appId;
    this.apiKey = apiKey;
  }

  async send(
    deviceToken: string,
    title: string,
    body: string,
    _data?: Record<string, string>
  ): Promise<string> {
    try {
      // TODO: integrate OneSignal SDK when credentials are provisioned. The
      // request payload (app_id, include_external_user_ids, headings,
      // contents, data, delivery_delay, priority) will be built here once
      // the real API call replaces the mock response below.
      logger.info('OneSignal notification prepared', {
        userId: deviceToken,
        title,
        body,
      });

      // Mock response for development
      return `onesignal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      logger.error('OneSignal send failed', { error: String(error) });
      throw error;
    }
  }

  async sendBatch(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string[]> {
    return Promise.all(deviceTokens.map((token) => this.send(token, title, body, data)));
  }

  async invalidateToken(deviceToken: string): Promise<void> {
    await deviceTokenService.removeToken(deviceToken);
  }
}

/**
 * No-op provider used when no push credentials are configured.
 * Logs a single warning at construction and silently accepts sends.
 */
export class NoopPushProvider implements PushProvider {
  constructor(log: { warn: (...a: unknown[]) => void } = logger) {
    log.warn('No push provider credentials configured; using NoopPushProvider');
  }

  async send(): Promise<string> {
    return 'noop';
  }

  async sendBatch(deviceTokens: string[]): Promise<string[]> {
    return deviceTokens.map(() => 'noop');
  }

  async invalidateToken(): Promise<void> {
    // no-op
  }
}

/**
 * Push Notification Service Manager
 * Handles sending push notifications via multiple providers
 *
 * Refactored for dependency injection (Issue #1701):
 * - Providers, defaultProvider, config, and logger can be injected
 */
export interface PushNotificationServiceDeps {
  providers?: Map<string, PushProvider>;
  defaultProvider?: string;
  config?: {
    push: {
      provider: string;
      firebase: { projectId?: string; serviceAccount?: string };
      onesignal: { appId?: string; apiKey?: string };
    };
    apns: { keyId?: string; teamId?: string; key?: string; bundleId?: string };
    nodeEnv: string;
  };
  logger?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; debug: (...a: unknown[]) => void };
}

export class PushNotificationService {
  private providers: Map<string, PushProvider> = new Map();
  private defaultProvider: string;
  private readonly log: NonNullable<PushNotificationServiceDeps['logger']>;

  constructor(deps?: PushNotificationServiceDeps) {
    this.log = deps?.logger ?? logger;
    const resolvedConfig = deps?.config ?? config;
    this.defaultProvider = deps?.defaultProvider ?? resolvedConfig.push.provider;

    if (deps?.providers) {
      this.providers = new Map(deps.providers);
    } else {
      this.setupProviders(resolvedConfig);
    }
  }

  private setupProviders(resolvedConfig: NonNullable<PushNotificationServiceDeps['config']>): void {
    // Firebase provider
    if (resolvedConfig.push.firebase.projectId && resolvedConfig.push.firebase.serviceAccount) {
      try {
        const firebase = new FirebasePushProvider(
          resolvedConfig.push.firebase.projectId,
          resolvedConfig.push.firebase.serviceAccount
        );
        this.providers.set('firebase', firebase);
        this.log.info('Firebase provider initialized');
      } catch (error) {
        this.log.error('Failed to initialize Firebase provider', { error: String(error) });
      }
    }

    // OneSignal provider
    if (resolvedConfig.push.onesignal.appId && resolvedConfig.push.onesignal.apiKey) {
      try {
        const oneSignal = new OneSignalPushProvider(
          resolvedConfig.push.onesignal.appId,
          resolvedConfig.push.onesignal.apiKey
        );
        this.providers.set('onesignal', oneSignal);
        this.log.info('OneSignal provider initialized');
      } catch (error) {
        this.log.error('Failed to initialize OneSignal provider', { error: String(error) });
      }
    }

    // APNs provider
    if (
      resolvedConfig.apns.keyId &&
      resolvedConfig.apns.teamId &&
      resolvedConfig.apns.key &&
      resolvedConfig.apns.bundleId
    ) {
      try {
        const apns = new ApnsProvider(
          resolvedConfig.apns.keyId,
          resolvedConfig.apns.teamId,
          resolvedConfig.apns.key.replace(/\\n/g, '\n'),
          resolvedConfig.apns.bundleId,
          resolvedConfig.nodeEnv === 'production'
        );
        this.providers.set('apns', apns);
        this.log.info('APNs provider initialized');
      } catch (error) {
        this.log.error('Failed to initialize APNs provider', { error: String(error) });
      }
    }

    // Fall back to a no-op provider when nothing is configured so callers
    // always have a provider to route through (Issue #1872).
    if (this.providers.size === 0) {
      this.providers.set('noop', new NoopPushProvider(this.log));
      this.defaultProvider = 'noop';
    }
  }

  getProvider(name?: string): PushProvider {
    const key = name ?? this.defaultProvider;
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`Push provider not configured: ${key}`);
    }
    return provider;
  }

  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    providerName?: string
  ): Promise<string> {
    return this.getProvider(providerName).send(deviceToken, title, body, data);
  }

  async sendBatch(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    providerName?: string
  ): Promise<string[]> {
    return this.getProvider(providerName).sendBatch(deviceTokens, title, body, data);
  }

  async invalidateToken(deviceToken: string, providerName?: string): Promise<void> {
    return this.getProvider(providerName).invalidateToken(deviceToken);
  }
}
