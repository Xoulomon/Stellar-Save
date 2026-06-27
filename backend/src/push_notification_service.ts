import https from 'https';
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { deviceTokenService } from './device_token_service';

/**
 * Abstract interface for push notification providers
 */
export interface PushNotificationProvider {
  send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string>;
}

/**
 * Firebase Cloud Messaging (FCM) Provider
 */
export class FirebaseProvider implements PushNotificationProvider {
  private projectId: string;
  private serviceAccount: any;

  constructor(projectId: string, serviceAccountJson: string) {
    this.projectId = projectId;
    try {
      this.serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new Error('Invalid Firebase service account JSON');
    }
  }

  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string> {
    try {
      // In production, use Firebase Admin SDK:
      // const admin = require('firebase-admin');
      // if (!admin.apps.length) {
      //   admin.initializeApp({
      //     credential: admin.credential.cert(this.serviceAccount),
      //     projectId: this.projectId,
      //   });
      // }
      // const message = {
      //   notification: { title, body },
      //   data: data || {},
      //   token: deviceToken,
      // };
      // return await admin.messaging().send(message);

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
}

/**
 * Apple Push Notification service (APNs) Provider
 * Uses HTTP/2 + JWT authentication
 */
export class ApnsProvider implements PushNotificationProvider {
  private keyId: string;
  private teamId: string;
  private privateKey: string;
  private bundleId: string;
  private production: boolean;

  constructor(keyId: string, teamId: string, privateKey: string, bundleId: string, production = false) {
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
            resolve(res.headers['apns-id'] as string || 'apns-ok');
          } else {
            const err: any = new Error(`APNs error: ${responseBody}`);
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
}

/**
 * OneSignal Provider
 */
export class OneSignalProvider implements PushNotificationProvider {
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
    data?: Record<string, string>
  ): Promise<string> {
    try {
      const payload = {
        app_id: this.appId,
        include_external_user_ids: [deviceToken],
        headings: { en: title },
        contents: { en: body },
        data: data || {},
        delivery_delay: 'immediate',
        priority: 10,
      };

      // In production:
      // const response = await fetch(`${this.baseUrl}/notifications`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json; charset=utf-8',
      //     'Authorization': `Basic ${this.apiKey}`,
      //   },
      //   body: JSON.stringify(payload),
      // });
      // const result = await response.json();
      // if (!response.ok) throw new Error(result.errors?.join(', '));
      // return result.body.id;

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
}

/**
 * Push Notification Service Manager
 * Handles sending push notifications via multiple providers
 */
export class PushNotificationService {
  private providers: Map<string, PushNotificationProvider> = new Map();
  private defaultProvider: string;

  constructor() {
    this.setupProviders();
    this.defaultProvider = process.env.PUSH_PROVIDER || 'firebase';
  }

  /**
   * Initialize configured push providers
   */
  private setupProviders(): void {
    // Firebase provider
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const firebase = new FirebaseProvider(
          process.env.FIREBASE_PROJECT_ID,
          process.env.FIREBASE_SERVICE_ACCOUNT
        );
        this.providers.set('firebase', firebase);
        logger.info('Firebase provider initialized');
      } catch (error) {
        logger.error('Failed to initialize Firebase provider', { error: String(error) });
      }
    }

    // OneSignal provider
    if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
      try {
        const oneSignal = new OneSignalProvider(
          process.env.ONESIGNAL_APP_ID,
          process.env.ONESIGNAL_API_KEY
        );
        this.providers.set('onesignal', oneSignal);
        logger.info('OneSignal provider initialized');
      } catch (error) {
        logger.error('Failed to initialize OneSignal provider', { error: String(error) });
      }
    }

    // APNs provider
    if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY && process.env.APNS_BUNDLE_ID) {
      try {
        const apns = new ApnsProvider(
          process.env.APNS_KEY_ID,
          process.env.APNS_TEAM_ID,
          process.env.APNS_KEY.replace(/\\n/g, '\n'),
          process.env.APNS_BUNDLE_ID,
          process.env.NODE_ENV === 'production'
        );
        this.providers.set('apns', apns);
        logger.info('APNs provider initialized');
      } catch (error) {
        logger.error('Failed to initialize APNs provider', { error: String(error) });
      }
    }

    if (this.providers.size === 0) {
      logger.warn('No push notification providers configured');
    }
  }

  /**
   * Send push notification via default provider
   */
  async send(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string> {
    const provider = this.providers.get(this.defaultProvider);

    if (!provider) {
      logger.warn(`Default provider '${this.defaultProvider}' not available`);
      return 'no-provider';
    }

    return await provider.send(deviceToken, title, body, data);
  }

  /**
   * Send push notification via specific provider
   */
  async sendVia(
    providerName: string,
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<string> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider '${providerName}' not configured`);
    }

    return await provider.send(deviceToken, title, body, data);
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Send to all mobile device tokens for a user, routing iOS to APNs and Android to Firebase.
   * Prunes invalid tokens on provider rejection.
   */
  async sendToUserMobile(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    const tokens = await deviceTokenService.getTokensForUser(userId);
    if (tokens.length === 0) return;

    await Promise.allSettled(
      tokens.map(async ({ token, platform }) => {
        const providerName = platform === 'ios' ? 'apns' : 'firebase';
        const provider = this.providers.get(providerName);
        if (!provider) {
          logger.warn(`No provider for platform ${platform}`);
          return;
        }
        try {
          await provider.send(token, title, body, data);
        } catch (err: any) {
          // 410 (APNs Gone) or 404 (FCM invalid) => prune token
          if (err.statusCode === 410 || err.statusCode === 404) {
            await deviceTokenService.markTokenInvalid(token);
            logger.info('Pruned invalid mobile token', { platform });
          } else {
            logger.error('Mobile push failed', { platform, error: String(err) });
          }
        }
      })
    );
  }
}

export const pushNotificationService = new PushNotificationService();
