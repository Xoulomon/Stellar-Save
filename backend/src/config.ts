// @app/config
/**
 * Centralised environment configuration for the Stellar-Save backend.
 *
 * All process.env access is consolidated here. The schema is validated once at
 * startup using zod; if any required variable is missing or malformed the
 * process exits immediately with a descriptive error so misconfiguration is
 * caught before the server accepts traffic.
 *
 * Usage:
 *   import { config } from './config';
 *   config.port          // number
 *   config.backup.bucket // string
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── Server ────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .default('3001')
    .transform(Number),

  // ── Database ──────────────────────────────────────────────────────────────
  // Support both DATABASE_URL (local/legacy) and individual components (ECS with Secrets Manager)
  DATABASE_URL: z.string().url().optional(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  DB_USERNAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_SECRET: z
    .string()
    .min(1, 'ADMIN_SECRET must not be empty')
    .default('super-secret-admin-key'),

  // ── Auth / JWT ────────────────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('stellar-save-jwt-secret-change-in-production-min32chars'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  JWT_REFRESH_TOKEN_TTL_DAYS: z.string().regex(/^\d+$/).default('30').transform(Number),

  // ── Privacy / GDPR ────────────────────────────────────────────────────────
  PII_RETENTION_DAYS: z.string().regex(/^\d+$/).default('365').transform(Number),

  // ── Stellar / Soroban ─────────────────────────────────────────────────────
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'futurenet', 'standalone']).default('testnet'),
  STELLAR_RPC_URL: z
    .string()
    .url('STELLAR_RPC_URL must be a valid URL')
    .default('https://soroban-testnet.stellar.org'),
  STELLAR_RPC_FALLBACK_URLS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    )
    .refine(
      (urls) => urls.every((url) => z.string().url().safeParse(url).success),
      'STELLAR_RPC_FALLBACK_URLS must be a comma-separated list of valid URLs'
    ),
  STELLAR_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),

  // ── Backup ────────────────────────────────────────────────────────────────
  BACKUP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  BACKUP_S3_BUCKET: z.string().default('stellar-save-backups'),
  BACKUP_RETENTION_DAYS: z
    .string()
    .regex(/^\d+$/, 'BACKUP_RETENTION_DAYS must be a positive integer')
    .default('30')
    .transform(Number),
  BACKUP_ALERT_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  BACKUP_DRILL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  BACKUP_DRILL_INTERVAL_MS: z
    .string()
    .regex(/^\d+$/)
    .default(String(24 * 60 * 60 * 1000))
    .transform(Number),
  BACKUP_DRILL_MAX_DURATION_MS: z
    .string()
    .regex(/^\d+$/)
    .default(String(5 * 60 * 1000))
    .transform(Number),

  // ── AWS ───────────────────────────────────────────────────────────────────
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),

  // ── Elasticsearch ─────────────────────────────────────────────────────────
  ELASTICSEARCH_NODE: z
    .string()
    .url('ELASTICSEARCH_NODE must be a valid URL')
    .default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().default('elastic'),
  ELASTICSEARCH_PASSWORD: z.string().default('changeme'),

  // ── KYC (Issue #1024) ─────────────────────────────────────────────────────
  KYC_PROVIDER_URL: z.string().url().default('https://sandbox.kyc-provider.example.com'),
  KYC_WEBHOOK_SECRET: z.string().default(''),

  // ── Keeper/relayer (Issue #1026) ──────────────────────────────────────────
  KEEPER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  KEEPER_SCHEDULE: z.string().default('*/5 * * * *'),

  // ── Tiered Rate Limiting (Issue #1164) ────────────────────────────────────
  RATE_LIMIT_FREE_REQ_PER_MIN: z.string().regex(/^\d+$/).default('30').transform(Number),
  RATE_LIMIT_FREE_REQ_PER_HOUR: z.string().regex(/^\d+$/).default('500').transform(Number),
  RATE_LIMIT_PRO_REQ_PER_MIN: z.string().regex(/^\d+$/).default('300').transform(Number),
  RATE_LIMIT_PRO_REQ_PER_HOUR: z.string().regex(/^\d+$/).default('10000').transform(Number),
  RATE_LIMIT_ENTERPRISE_REQ_PER_MIN: z.string().regex(/^\d+$/).default('3000').transform(Number),
  RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR: z.string().regex(/^\d+$/).default('100000').transform(Number),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/).default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // ── CORS ──────────────────────────────────────────────────────────────────
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  // ── Frontend / App URL ────────────────────────────────────────────────────
  FRONTEND_URL: z.string().url().default('https://stellar-save.com'),
  APP_URL: z.string().url().default('https://stellar-save.com'),

  // ── SendGrid ──────────────────────────────────────────────────────────────
  SENDGRID_API_KEY: z.string().default(''),
  SENDGRID_FROM_EMAIL: z.string().email().default('noreply@stellar-save.com'),
  SENDGRID_REPLY_TO: z.string().email().default('support@stellar-save.com'),

  // ── Push notifications ────────────────────────────────────────────────────
  PUSH_PROVIDER: z.enum(['firebase', 'onesignal']).default('firebase'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_API_KEY: z.string().optional(),

  // ── VAPID (Web Push) ──────────────────────────────────────────────────────
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:noreply@stellar-save.com'),

  // ── Distributed Tracing (OpenTelemetry) ──────────────────────────────────
  OTEL_TRACES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OTEL_SERVICE_NAME: z.string().default('stellar-save-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_TRACES_SAMPLER_ARG: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .default('0.1')
    .transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Soroban connection pool ────────────────────────────────────────────────
  SOROBAN_POOL_SIZE: z.string().regex(/^\d+$/).default('5').transform(Number),
  SOROBAN_POOL_TIMEOUT_MS: z.string().regex(/^\d+$/).default('5000').transform(Number),

  // ── RPC circuit breakers (Soroban / Horizon) ──────────────────────────────
  RPC_BREAKER_TIMEOUT_MS: z.string().regex(/^\d+$/).default('8000').transform(Number),
  RPC_BREAKER_ERROR_THRESHOLD_PCT: z.string().regex(/^\d+$/).default('50').transform(Number),
  RPC_BREAKER_RESET_TIMEOUT_MS: z.string().regex(/^\d+$/).default('15000').transform(Number),
  RPC_BREAKER_VOLUME_THRESHOLD: z.string().regex(/^\d+$/).default('5').transform(Number),
  RPC_BREAKER_STALE_CACHE_TTL_SECONDS: z.string().regex(/^\d+$/).default('300').transform(Number),

  // ── Horizon / Contract Indexer ────────────────────────────────────────────
  HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  CONTRACT_ID: z.string().default(''),
  INDEXER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // ── On-chain monitor ──────────────────────────────────────────────────────
  ON_CHAIN_MONITOR_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS: z.string().regex(/^\d+$/).default('100000000000'),

  // ── Fraud detection ───────────────────────────────────────────────────────
  FRAUD_DETECTION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  FRAUD_SYBIL_THRESHOLD: z.string().regex(/^\d+$/).default('3').transform(Number),
  FRAUD_RAPID_CYCLE_HOURS: z.string().regex(/^\d+$/).default('24').transform(Number),
  FRAUD_CONTRIBUTION_OUTLIER_FACTOR: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .default('3')
    .transform(Number),
  FRAUD_SCAN_INTERVAL_MINUTES: z.string().regex(/^\d+$/).default('60').transform(Number),

  // ── Analytics resync ──────────────────────────────────────────────────────
  ANALYTICS_RESYNC_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ANALYTICS_RESYNC_SCHEDULE: z.string().default('0 * * * *'),

  // ── CAPTCHA ───────────────────────────────────────────────────────────────
  CAPTCHA_SECRET_KEY: z.string().optional(),

  // ── APNs (Apple Push Notification service) ────────────────────────────────
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),

  // ── Governance ────────────────────────────────────────────────────────────
  GOVERNOR_ADDRESSES: z.string().default(''),

  // ── Service metadata ──────────────────────────────────────────────────────
  SERVICE_NAME: z.string().default('stellar-save-backend'),
  SERVICE_VERSION: z.string().default('1.0.0'),

  // ── OpenTelemetry Traces Endpoint ──────────────────────────────────────────
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional().or(z.literal('')),

  // ── Redis URL ─────────────────────────────────────────────────────────────
  REDIS_URL: z.string().optional(),

  // ── TLS ───────────────────────────────────────────────────────────────────
  TLS_KEY_PATH: z.string().optional(),
  TLS_CERT_PATH: z.string().optional(),

  // ── IPFS ────────────────────────────────────────────────────────────────────
  IPFS_API_URL: z.string().url().default('http://localhost:5001'),
  IPFS_API_TIMEOUT_MS: z.string().regex(/^\d+$/).default('30000').transform(Number),
  IPFS_GATEWAY_URL: z.string().url().default('http://localhost:8080'),
  IPFS_PIN_RETRY_COUNT: z.string().regex(/^\d+$/).default('3').transform(Number),
  IPFS_PIN_CHECK_INTERVAL_MS: z.string().regex(/^\d+$/).default('5000').transform(Number),
  IPFS_MONITOR_INTERVAL_MS: z.string().regex(/^\d+$/).default('60000').transform(Number),
  IPFS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export { envSchema };

// ---------------------------------------------------------------------------
// Validation — fail fast on startup
// ---------------------------------------------------------------------------

export function formatValidationErrors(issues: z.ZodIssue[]): string[] {
  return issues.map((i) => {
    const field = i.path.join('.') || 'variable';
    if (i.code === 'invalid_type' && (i as z.ZodInvalidTypeIssue).received === 'undefined') {
      return `Missing required environment variable: ${field}`;
    }
    return `Invalid configuration for "${field}": ${i.message}`;
  });
}

export function validateConfig(rawEnv: NodeJS.ProcessEnv = process.env): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = formatValidationErrors(result.error.issues);
    process.stderr.write(
      JSON.stringify({
        level: 'error',
        message: 'invalid environment configuration',
        issues,
        hint: 'Check your .env file against .env.example and fix the above variables.',
      }) + '\n'
    );
    throw new Error(`Invalid environment configuration: ${issues.join(', ')}`);
  }
  return result.data;
}

let env: z.infer<typeof envSchema>;
try {
  env = validateConfig(process.env);
} catch {
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Database URL construction
// ---------------------------------------------------------------------------

/**
 * Construct DATABASE_URL from individual components if not provided directly.
 * This supports ECS deployments where credentials come from Secrets Manager.
 */
function getDatabaseUrl(envData: z.infer<typeof envSchema>): string {
  if (envData.DATABASE_URL) {
    return envData.DATABASE_URL;
  }

  // Construct from individual components
  if (
    envData.DB_USERNAME &&
    envData.DB_PASSWORD &&
    envData.DB_HOST &&
    envData.DB_PORT &&
    envData.DB_NAME
  ) {
    return `postgresql://${envData.DB_USERNAME}:${envData.DB_PASSWORD}@${envData.DB_HOST}:${envData.DB_PORT}/${envData.DB_NAME}`;
  }

  // Fallback for local development. This is the single source of truth for the
  // default local connection string; callers must not duplicate it.
  return 'postgresql://user:pass@localhost:5432/stellar_save';
}

// ---------------------------------------------------------------------------
// Typed config builder (grouped for readability)
// ---------------------------------------------------------------------------

export function buildConfig(envData: z.infer<typeof envSchema>) {
  return {
    nodeEnv: envData.NODE_ENV,
    port: envData.PORT,
    serviceName: envData.SERVICE_NAME,
    serviceVersion: envData.SERVICE_VERSION,

    governance: {
      governorAddresses: envData.GOVERNOR_ADDRESSES
        ? envData.GOVERNOR_ADDRESSES.split(',')
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
    },

    database: {
      url: getDatabaseUrl(envData),
      replicaUrl: envData.DATABASE_REPLICA_URL,
    },

    admin: {
      secret: envData.ADMIN_SECRET,
    },

    auth: {
      jwtSecret: envData.JWT_SECRET,
      accessTokenTtl: envData.JWT_ACCESS_TOKEN_TTL,
      refreshTokenTtlDays: envData.JWT_REFRESH_TOKEN_TTL_DAYS,
    },

    privacy: {
      piiRetentionDays: envData.PII_RETENTION_DAYS,
    },

    stellar: {
      network: envData.STELLAR_NETWORK,
      rpcUrl: envData.STELLAR_RPC_URL,
      fallbackRpcUrls: envData.STELLAR_RPC_FALLBACK_URLS,
      networkPassphrase: envData.STELLAR_NETWORK_PASSPHRASE,
    },

    backup: {
      enabled: envData.BACKUP_ENABLED,
      bucket: envData.BACKUP_S3_BUCKET,
      retentionDays: envData.BACKUP_RETENTION_DAYS,
      alertWebhookUrl: envData.BACKUP_ALERT_WEBHOOK_URL || undefined,
      drillEnabled: envData.BACKUP_DRILL_ENABLED,
      drillIntervalMs: envData.BACKUP_DRILL_INTERVAL_MS,
      drillMaxDurationMs: envData.BACKUP_DRILL_MAX_DURATION_MS,
    },

    aws: {
      region: envData.AWS_REGION,
      accessKeyId: envData.AWS_ACCESS_KEY_ID,
      secretAccessKey: envData.AWS_SECRET_ACCESS_KEY,
    },

    elasticsearch: {
      node: envData.ELASTICSEARCH_NODE,
      username: envData.ELASTICSEARCH_USERNAME,
      password: envData.ELASTICSEARCH_PASSWORD,
    },

    kyc: {
      providerUrl: envData.KYC_PROVIDER_URL,
      webhookSecret: envData.KYC_WEBHOOK_SECRET,
    },

    keeper: {
      enabled: envData.KEEPER_ENABLED,
      schedule: envData.KEEPER_SCHEDULE,
    },

    rateLimiting: {
      free: {
        perMin: envData.RATE_LIMIT_FREE_REQ_PER_MIN,
        perHour: envData.RATE_LIMIT_FREE_REQ_PER_HOUR,
      },
      pro: {
        perMin: envData.RATE_LIMIT_PRO_REQ_PER_MIN,
        perHour: envData.RATE_LIMIT_PRO_REQ_PER_HOUR,
      },
      enterprise: {
        perMin: envData.RATE_LIMIT_ENTERPRISE_REQ_PER_MIN,
        perHour: envData.RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR,
      },
    },

    redis: {
      host: envData.REDIS_HOST,
      port: envData.REDIS_PORT,
      password: envData.REDIS_PASSWORD,
      url: envData.REDIS_URL,
    },

    cors: {
      allowedOrigins: envData.CORS_ALLOWED_ORIGINS
        ? envData.CORS_ALLOWED_ORIGINS.split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    },

    urls: {
      frontend: envData.FRONTEND_URL,
      app: envData.APP_URL,
    },

    sendgrid: {
      apiKey: envData.SENDGRID_API_KEY,
      fromEmail: envData.SENDGRID_FROM_EMAIL,
      replyTo: envData.SENDGRID_REPLY_TO,
    },

    push: {
      provider: envData.PUSH_PROVIDER,
      firebase: {
        projectId: envData.FIREBASE_PROJECT_ID,
        serviceAccount: envData.FIREBASE_SERVICE_ACCOUNT,
      },
      onesignal: {
        appId: envData.ONESIGNAL_APP_ID,
        apiKey: envData.ONESIGNAL_API_KEY,
      },
    },

    vapid: {
      publicKey: envData.VAPID_PUBLIC_KEY,
      privateKey: envData.VAPID_PRIVATE_KEY,
      subject: envData.VAPID_SUBJECT,
    },

    tracing: {
      enabled: envData.OTEL_TRACES_ENABLED,
      serviceName: envData.OTEL_SERVICE_NAME,
      otlpEndpoint: envData.OTEL_EXPORTER_OTLP_ENDPOINT,
      otlpTracesEndpoint: envData.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || undefined,
      samplerArg: envData.OTEL_TRACES_SAMPLER_ARG,
    },

    logging: {
      level: envData.LOG_LEVEL,
    },

    soroban: {
      poolSize: envData.SOROBAN_POOL_SIZE,
      poolTimeoutMs: envData.SOROBAN_POOL_TIMEOUT_MS,
    },

    rpcCircuitBreaker: {
      timeoutMs: envData.RPC_BREAKER_TIMEOUT_MS,
      errorThresholdPercentage: envData.RPC_BREAKER_ERROR_THRESHOLD_PCT,
      resetTimeoutMs: envData.RPC_BREAKER_RESET_TIMEOUT_MS,
      volumeThreshold: envData.RPC_BREAKER_VOLUME_THRESHOLD,
      staleCacheTtlSeconds: envData.RPC_BREAKER_STALE_CACHE_TTL_SECONDS,
    },

    indexer: {
      enabled: envData.INDEXER_ENABLED,
      horizonUrl: envData.HORIZON_URL,
      contractId: envData.CONTRACT_ID,
    },

    onChainMonitor: {
      enabled: envData.ON_CHAIN_MONITOR_ENABLED,
      largePayoutThresholdStroops: BigInt(envData.ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS),
    },

    fraud: {
      enabled: envData.FRAUD_DETECTION_ENABLED,
      sybilThreshold: envData.FRAUD_SYBIL_THRESHOLD,
      rapidCycleHours: envData.FRAUD_RAPID_CYCLE_HOURS,
      outlierFactor: envData.FRAUD_CONTRIBUTION_OUTLIER_FACTOR,
      scanIntervalMinutes: envData.FRAUD_SCAN_INTERVAL_MINUTES,
    },

    analyticsResync: {
      enabled: envData.ANALYTICS_RESYNC_ENABLED,
      schedule: envData.ANALYTICS_RESYNC_SCHEDULE,
    },

    captcha: {
      secretKey: envData.CAPTCHA_SECRET_KEY,
    },

    apns: {
      keyId: envData.APNS_KEY_ID,
      teamId: envData.APNS_TEAM_ID,
      key: envData.APNS_KEY,
      bundleId: envData.APNS_BUNDLE_ID,
    },

    tls: {
      keyPath: envData.TLS_KEY_PATH,
      certPath: envData.TLS_CERT_PATH,
    },

    ipfs: {
      enabled: envData.IPFS_ENABLED,
      apiUrl: envData.IPFS_API_URL,
      apiTimeoutMs: envData.IPFS_API_TIMEOUT_MS,
      gatewayUrl: envData.IPFS_GATEWAY_URL,
      pinRetryCount: envData.IPFS_PIN_RETRY_COUNT,
      pinCheckIntervalMs: envData.IPFS_PIN_CHECK_INTERVAL_MS,
      monitorIntervalMs: envData.IPFS_MONITOR_INTERVAL_MS,
    },
  };
}

export type Config = ReturnType<typeof buildConfig>;

export const config: Config = buildConfig(env);

/**
 * Updates a sensitive secret in memory (e.g. when pulled from AWS Secrets Manager)
 * without directly mutating process.env.
 *
 * Note: `DB_PASSWORD` is intentionally not supported here. It is only consumed
 * once at startup to construct `database.url`; mutating it afterwards would have
 * no effect on the already-built connection string.
 */
export function updateConfigSecret(key: 'JWT_SECRET' | 'ADMIN_SECRET', value: string): void {
  if (key === 'JWT_SECRET') {
    (config.auth as { jwtSecret: string }).jwtSecret = value;
  } else if (key === 'ADMIN_SECRET') {
    (config.admin as { secret: string }).secret = value;
  }
}
