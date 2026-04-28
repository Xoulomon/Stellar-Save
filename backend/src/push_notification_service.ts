import { logger } from './logger';

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
}

export const pushNotificationService = new PushNotificationService();
