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
  },

  admin: {
    secret: env.ADMIN_SECRET,
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
} as const;
