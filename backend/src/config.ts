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

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── Server ────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
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
  JWT_REFRESH_TOKEN_TTL_DAYS: z
    .string()
    .regex(/^\d+$/)
    .default('30')
    .transform(Number),

  // ── Privacy / GDPR ────────────────────────────────────────────────────────
  PII_RETENTION_DAYS: z
    .string()
    .regex(/^\d+$/)
    .default('365')
    .transform(Number),

  // ── Stellar / Soroban ─────────────────────────────────────────────────────
  STELLAR_NETWORK: z
    .enum(['testnet', 'mainnet', 'futurenet', 'standalone'])
    .default('testnet'),
  STELLAR_RPC_URL: z
    .string()
    .url('STELLAR_RPC_URL must be a valid URL')
    .default('https://soroban-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .default('Test SDF Network ; September 2015'),

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
  KYC_PROVIDER_URL: z
    .string()
    .url()
    .default('https://sandbox.kyc-provider.example.com'),
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
  OTEL_TRACES_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  OTEL_SERVICE_NAME: z.string().default('stellar-save-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_TRACES_SAMPLER_ARG: z.string().regex(/^\d*\.?\d+$/).default('0.1').transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Soroban connection pool ────────────────────────────────────────────────
  SOROBAN_POOL_SIZE: z.string().regex(/^\d+$/).default('5').transform(Number),
  SOROBAN_POOL_TIMEOUT_MS: z.string().regex(/^\d+$/).default('5000').transform(Number),

  // ── Horizon / Contract Indexer ────────────────────────────────────────────
  HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  CONTRACT_ID: z.string().default(''),
  INDEXER_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),

  // ── On-chain monitor ──────────────────────────────────────────────────────
  ON_CHAIN_MONITOR_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS: z.string().regex(/^\d+$/).default('100000000000'),

  // ── Fraud detection ───────────────────────────────────────────────────────
  FRAUD_DETECTION_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  FRAUD_SYBIL_THRESHOLD: z.string().regex(/^\d+$/).default('3').transform(Number),
  FRAUD_RAPID_CYCLE_HOURS: z.string().regex(/^\d+$/).default('24').transform(Number),
  FRAUD_CONTRIBUTION_OUTLIER_FACTOR: z.string().regex(/^\d*\.?\d+$/).default('3').transform(Number),
  FRAUD_SCAN_INTERVAL_MINUTES: z.string().regex(/^\d+$/).default('60').transform(Number),

  // ── Analytics resync ──────────────────────────────────────────────────────
  ANALYTICS_RESYNC_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  ANALYTICS_RESYNC_SCHEDULE: z.string().default('0 * * * *'),

  // ── CAPTCHA ───────────────────────────────────────────────────────────────
  CAPTCHA_SECRET_KEY: z.string().optional(),

  // ── APNs (Apple Push Notification service) ────────────────────────────────
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),

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
  IPFS_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

// ---------------------------------------------------------------------------
// Validation — fail fast on startup
// ---------------------------------------------------------------------------

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(
    `\n[config] ❌ Invalid environment configuration:\n${issues}\n` +
      `  Check your .env file against .env.example and fix the above variables.\n`,
  );
  process.exit(1);
}

const env = parsed.data;

// ---------------------------------------------------------------------------
// Database URL construction
// ---------------------------------------------------------------------------

/**
 * Construct DATABASE_URL from individual components if not provided directly.
 * This supports ECS deployments where credentials come from Secrets Manager.
 */
function getDatabaseUrl(): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  // Construct from individual components
  if (env.DB_USERNAME && env.DB_PASSWORD && env.DB_HOST && env.DB_PORT && env.DB_NAME) {
    return `postgresql://${env.DB_USERNAME}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
  }

  // Fallback for local development
  console.warn(
    '[config] ⚠️  Neither DATABASE_URL nor complete DB_* variables provided. ' +
    'Using default local connection.'
  );
  return 'postgresql://user:pass@localhost:5432/stellar_save';
}

// ---------------------------------------------------------------------------
// Typed config object (grouped for readability)
// ---------------------------------------------------------------------------

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,

  database: {
    url: getDatabaseUrl(),
    replicaUrl: env.DATABASE_REPLICA_URL,
  },

  admin: {
    secret: env.ADMIN_SECRET,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    accessTokenTtl: env.JWT_ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: env.JWT_REFRESH_TOKEN_TTL_DAYS,
  },

  privacy: {
    piiRetentionDays: env.PII_RETENTION_DAYS,
  },

  stellar: {
    network: env.STELLAR_NETWORK,
    rpcUrl: env.STELLAR_RPC_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  },

  backup: {
    enabled: env.BACKUP_ENABLED,
    bucket: env.BACKUP_S3_BUCKET,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    alertWebhookUrl: env.BACKUP_ALERT_WEBHOOK_URL || undefined,
  },

  aws: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },

  elasticsearch: {
    node: env.ELASTICSEARCH_NODE,
    username: env.ELASTICSEARCH_USERNAME,
    password: env.ELASTICSEARCH_PASSWORD,
  },

  kyc: {
    providerUrl: env.KYC_PROVIDER_URL,
    webhookSecret: env.KYC_WEBHOOK_SECRET,
  },

  keeper: {
    enabled: env.KEEPER_ENABLED,
    schedule: env.KEEPER_SCHEDULE,
  },

  rateLimiting: {
    free: {
      perMin: env.RATE_LIMIT_FREE_REQ_PER_MIN,
      perHour: env.RATE_LIMIT_FREE_REQ_PER_HOUR,
    },
    pro: {
      perMin: env.RATE_LIMIT_PRO_REQ_PER_MIN,
      perHour: env.RATE_LIMIT_PRO_REQ_PER_HOUR,
    },
    enterprise: {
      perMin: env.RATE_LIMIT_ENTERPRISE_REQ_PER_MIN,
      perHour: env.RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR,
    },
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS
      ? env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      : [],
  },

  urls: {
    frontend: env.FRONTEND_URL,
    app: env.APP_URL,
  },

  sendgrid: {
    apiKey: env.SENDGRID_API_KEY,
    fromEmail: env.SENDGRID_FROM_EMAIL,
    replyTo: env.SENDGRID_REPLY_TO,
  },

  push: {
    provider: env.PUSH_PROVIDER,
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    },
    onesignal: {
      appId: env.ONESIGNAL_APP_ID,
      apiKey: env.ONESIGNAL_API_KEY,
    },
  },

  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  },

  tracing: {
    enabled: env.OTEL_TRACES_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    samplerArg: env.OTEL_TRACES_SAMPLER_ARG,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  soroban: {
    poolSize: env.SOROBAN_POOL_SIZE,
    poolTimeoutMs: env.SOROBAN_POOL_TIMEOUT_MS,
  },

  indexer: {
    enabled: env.INDEXER_ENABLED,
    horizonUrl: env.HORIZON_URL,
    contractId: env.CONTRACT_ID,
  },

  onChainMonitor: {
    enabled: env.ON_CHAIN_MONITOR_ENABLED,
    largePayoutThresholdStroops: BigInt(env.ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS),
  },

  fraud: {
    enabled: env.FRAUD_DETECTION_ENABLED,
    sybilThreshold: env.FRAUD_SYBIL_THRESHOLD,
    rapidCycleHours: env.FRAUD_RAPID_CYCLE_HOURS,
    outlierFactor: env.FRAUD_CONTRIBUTION_OUTLIER_FACTOR,
    scanIntervalMinutes: env.FRAUD_SCAN_INTERVAL_MINUTES,
  },

  analyticsResync: {
    enabled: env.ANALYTICS_RESYNC_ENABLED,
    schedule: env.ANALYTICS_RESYNC_SCHEDULE,
  },

  captcha: {
    secretKey: env.CAPTCHA_SECRET_KEY,
  },

  apns: {
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    key: env.APNS_KEY,
    bundleId: env.APNS_BUNDLE_ID,
  },

  tls: {
    keyPath: env.TLS_KEY_PATH,
    certPath: env.TLS_CERT_PATH,
  },

  ipfs: {
    enabled: env.IPFS_ENABLED,
    apiUrl: env.IPFS_API_URL,
    apiTimeoutMs: env.IPFS_API_TIMEOUT_MS,
    gatewayUrl: env.IPFS_GATEWAY_URL,
    pinRetryCount: env.IPFS_PIN_RETRY_COUNT,
    pinCheckIntervalMs: env.IPFS_PIN_CHECK_INTERVAL_MS,
    monitorIntervalMs: env.IPFS_MONITOR_INTERVAL_MS,
  },
} as const;
