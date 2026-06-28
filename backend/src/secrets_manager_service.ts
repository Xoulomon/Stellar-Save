/**
 * Secrets Manager Service (Issue #1105)
 * 
 * AWS Secrets Manager integration with automatic rotation support.
 * Removes hardcoded secrets from environment files and provides
 * centralized secret management with audit logging.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretCommand,
  RotateSecretCommand,
  DescribeSecretCommand,
  CreateSecretCommand,
  TagResourceCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';
import { config } from './config';

export interface SecretMetadata {
  name: string;
  arn?: string;
  lastRotated?: Date;
  nextRotation?: Date;
  rotationEnabled: boolean;
  rotationIntervalDays: number;
}

export interface SecretValue {
  value: string;
  version?: string;
  createdDate?: Date;
}

export interface RotationConfig {
  automaticallyAfterDays: number;
  lambdaArn?: string; // For custom rotation
}

export class SecretsManagerService {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: string; expiry: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.client = new SecretsManagerClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      } : undefined,
    });
  }

  /**
   * Get a secret value (with caching)
   */
  async getSecret(secretName: string, useCache = true): Promise<SecretValue> {
    try {
      // Check cache first
      if (useCache) {
        const cached = this.cache.get(secretName);
        if (cached && cached.expiry > Date.now()) {
          logger.debug('Secret retrieved from cache', { secretName });
          return { value: cached.value };
        }
      }

      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} has no string value`);
      }

      // Update cache
      if (useCache) {
        this.cache.set(secretName, {
          value: response.SecretString,
          expiry: Date.now() + this.CACHE_TTL_MS,
        });
      }

      logger.info('Secret retrieved from AWS Secrets Manager', {
        secretName,
        version: response.VersionId,
      });

      return {
        value: response.SecretString,
        version: response.VersionId,
        createdDate: response.CreatedDate,
      };
    } catch (error) {
      logger.error('Failed to retrieve secret', {
        secretName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to retrieve secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new secret
   */
  async createSecret(
    secretName: string,
    secretValue: string,
    description?: string,
    tags?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretValue,
        Description: description,
        Tags: tags ? Object.entries(tags).map(([Key, Value]) => ({ Key, Value })) : undefined,
      });

      const response = await this.client.send(command);

      logger.info('Secret created', {
        secretName,
        arn: response.ARN,
      });

      return response.ARN || '';
    } catch (error) {
      logger.error('Failed to create secret', { secretName, error });
      throw error;
    }
  }

  /**
   * Update a secret value
   */
  async updateSecret(secretName: string, newValue: string): Promise<void> {
    try {
      const command = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: newValue,
      });

      await this.client.send(command);

      // Invalidate cache
      this.cache.delete(secretName);

      logger.info('Secret updated', { secretName });
    } catch (error) {
      logger.error('Failed to update secret', { secretName, error });
      throw error;
    }
  }

  /**
   * Enable automatic rotation for a secret
   */
  async enableRotation(
    secretName: string,
    rotationConfig: RotationConfig
  ): Promise<void> {
    try {
      const command = new UpdateSecretCommand({
        SecretId: secretName,
        RotationLambdaARN: rotationConfig.lambdaArn,
        RotationRules: {
          AutomaticallyAfterDays: rotationConfig.automaticallyAfterDays,
        },
      });

      await this.client.send(command);

      logger.info('Secret rotation enabled', {
        secretName,
        intervalDays: rotationConfig.automaticallyAfterDays,
      });
    } catch (error) {
      logger.error('Failed to enable rotation', { secretName, error });
      throw error;
    }
  }

  /**
   * Manually trigger secret rotation
   */
  async rotateSecret(secretName: string): Promise<void> {
    try {
      const command = new RotateSecretCommand({
        SecretId: secretName,
        RotateImmediately: true,
      });

      await this.client.send(command);

      // Invalidate cache
      this.cache.delete(secretName);

      logger.info('Secret rotation triggered', { secretName });
    } catch (error) {
      logger.error('Failed to rotate secret', { secretName, error });
      throw error;
    }
  }

  /**
   * Get secret metadata
   */
  async getSecretMetadata(secretName: string): Promise<SecretMetadata> {
    try {
      const command = new DescribeSecretCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      return {
        name: response.Name || secretName,
        arn: response.ARN,
        lastRotated: response.LastRotatedDate,
        nextRotation: response.NextRotationDate,
        rotationEnabled: response.RotationEnabled || false,
        rotationIntervalDays: response.RotationRules?.AutomaticallyAfterDays || 0,
      };
    } catch (error) {
      logger.error('Failed to get secret metadata', { secretName, error });
      throw error;
    }
  }

  /**
   * Clear cache for a specific secret or all secrets
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.cache.delete(secretName);
      logger.debug('Cache cleared for secret', { secretName });
    } else {
      this.cache.clear();
      logger.debug('All secret cache cleared');
    }
  }

  /**
   * Add tags to a secret
   */
  async tagSecret(secretName: string, tags: Record<string, string>): Promise<void> {
    try {
      // First get the ARN
      const metadata = await this.getSecretMetadata(secretName);
      
      if (!metadata.arn) {
        throw new Error('Secret ARN not found');
      }

      const command = new TagResourceCommand({
        SecretId: metadata.arn,
        Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
      });

      await this.client.send(command);

      logger.info('Secret tagged', { secretName, tags });
    } catch (error) {
      logger.error('Failed to tag secret', { secretName, error });
      throw error;
    }
  }

  /**
   * Get multiple secrets in batch
   */
  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    await Promise.all(
      secretNames.map(async (name) => {
        try {
          const secret = await this.getSecret(name);
          results[name] = secret.value;
        } catch (error) {
          logger.warn('Failed to retrieve secret in batch', { secretName: name, error });
        }
      })
    );

    return results;
  }

  /**
   * Check rotation status for all managed secrets
   */
  async checkRotationStatus(secretNames: string[]): Promise<{
    upToDate: string[];
    needsRotation: string[];
    failed: string[];
  }> {
    const upToDate: string[] = [];
    const needsRotation: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      secretNames.map(async (name) => {
        try {
          const metadata = await this.getSecretMetadata(name);

          if (!metadata.rotationEnabled) {
            needsRotation.push(name);
            return;
          }

          if (metadata.nextRotation && metadata.nextRotation < new Date()) {
            needsRotation.push(name);
          } else {
            upToDate.push(name);
          }
        } catch (error) {
          failed.push(name);
          logger.error('Failed to check rotation status', { secretName: name, error });
        }
      })
    );

    return { upToDate, needsRotation, failed };
  }
}

/**
 * Singleton instance
 */
export const secretsManager = new SecretsManagerService();

/**
 * Helper function to migrate from environment variables to Secrets Manager
 */
export async function migrateSecretToAWS(
  secretName: string,
  envVarValue: string,
  description: string
): Promise<void> {
  try {
    await secretsManager.createSecret(
      secretName,
      envVarValue,
      description,
      {
        Environment: config.nodeEnv,
        ManagedBy: 'stellar-save-backend',
        CreatedAt: new Date().toISOString(),
      }
    );

    logger.info('Secret migrated to AWS Secrets Manager', {
      secretName,
      description,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.warn('Secret already exists in AWS', { secretName });
    } else {
      throw error;
    }
  }
}

/**
 * Initialize secrets on application startup
 */
export async function initializeSecrets(): Promise<void> {
  logger.info('Initializing secrets from AWS Secrets Manager');

  // List of secrets to initialize
  const secretConfigs = [
    { name: 'stellar-save/jwt-secret', envVar: 'JWT_SECRET' },
    { name: 'stellar-save/admin-secret', envVar: 'ADMIN_SECRET' },
    { name: 'stellar-save/db-password', envVar: 'DB_PASSWORD' },
  ];

  for (const { name, envVar } of secretConfigs) {
    try {
      const secret = await secretsManager.getSecret(name);
      
      // Override environment variable with secret from AWS
      process.env[envVar] = secret.value;
      
      logger.info('Secret loaded from AWS', { secretName: name });
    } catch (error) {
      logger.warn('Failed to load secret from AWS, using environment variable', {
        secretName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Secrets initialization complete');
}
