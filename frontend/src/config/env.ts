/**
 * env.ts
 *
 * Single source of truth for all VITE_ environment variables consumed by the
 * frontend.  All reads from `import.meta.env` are centralised here; every
 * other module should import from this file instead.
 *
 * Validation runs once at module load time. If a required variable is missing
 * the application throws with a clear, actionable message rather than failing
 * silently at the point of use.
 */

// ─── Schema ───────────────────────────────────────────────────────────────────

interface EnvSchema {
  /** Stellar network to connect to. Defaults to "testnet". */
  VITE_STELLAR_NETWORK: 'mainnet' | 'testnet';
  /** Soroban RPC endpoint. Required for all contract calls. */
  VITE_STELLAR_RPC_URL: string;
  /**
   * Deployed StellarSave contract address.
   * Required for any contract interaction; may be empty during local
   * development before a contract has been deployed.
   */
  VITE_STELLAR_SAVE_CONTRACT_ID: string;
  /**
   * Set to "true" to enable remote error reporting via Sentry.
   * Defaults to false.
   */
  VITE_ENABLE_ERROR_REPORTING: boolean;
  /**
   * Sentry DSN for error reporting.
   * Only used when VITE_ENABLE_ERROR_REPORTING is true.
   */
  VITE_SENTRY_DSN: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawEnv = Record<string, string | undefined>;

function readString(env: RawEnv, key: string, fallback: string): string {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readBoolean(env: RawEnv, key: string, fallback: boolean): boolean {
  const value = env[key];
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function assertNetwork(raw: string): 'mainnet' | 'testnet' {
  if (raw === 'mainnet' || raw === 'testnet') return raw;
  throw new Error(
    `[env] VITE_STELLAR_NETWORK must be "mainnet" or "testnet", got: "${raw}". ` +
      'Check your .env file.',
  );
}

// ─── Required-variable guard ──────────────────────────────────────────────────

/**
 * Variables that must be non-empty in production. A missing value at startup
 * throws immediately instead of producing confusing runtime failures.
 */
const REQUIRED_IN_PRODUCTION: (keyof EnvSchema)[] = ['VITE_STELLAR_RPC_URL'];

function validateRequired(
  env: RawEnv,
  required: (keyof EnvSchema)[],
  nodeEnv: string,
): void {
  if (nodeEnv === 'production') {
    const missing = required.filter((key) => {
      const v = env[key as string];
      return typeof v !== 'string' || v.length === 0;
    });
    if (missing.length > 0) {
      throw new Error(
        `[env] Missing required environment variables for production build:\n` +
          missing.map((k) => `  • ${k}`).join('\n') +
          `\nAdd them to your .env file or CI environment.`,
      );
    }
  }
}

// ─── Build & export ───────────────────────────────────────────────────────────

function buildEnvConfig(): Readonly<EnvSchema> {
  // Cast to RawEnv so we can access keys safely without TypeScript's
  // import.meta.env declarations overriding our runtime-safe reads.
  const raw = import.meta.env as unknown as RawEnv;

  const nodeEnv: string =
    typeof process !== 'undefined' && process.env?.['NODE_ENV']
      ? (process.env['NODE_ENV'] as string)
      : readString(raw, 'MODE', 'development');

  validateRequired(raw, REQUIRED_IN_PRODUCTION, nodeEnv);

  const networkRaw = readString(raw, 'VITE_STELLAR_NETWORK', 'testnet');

  return Object.freeze({
    VITE_STELLAR_NETWORK: assertNetwork(networkRaw),
    VITE_STELLAR_RPC_URL: readString(
      raw,
      'VITE_STELLAR_RPC_URL',
      'https://soroban-testnet.stellar.org',
    ),
    VITE_STELLAR_SAVE_CONTRACT_ID: readString(raw, 'VITE_STELLAR_SAVE_CONTRACT_ID', ''),
    VITE_ENABLE_ERROR_REPORTING: readBoolean(raw, 'VITE_ENABLE_ERROR_REPORTING', false),
    VITE_SENTRY_DSN: readString(raw, 'VITE_SENTRY_DSN', ''),
  });
}

/**
 * Typed, validated snapshot of all frontend environment variables.
 *
 * @example
 * import { env } from '../config/env';
 * const rpcUrl = env.VITE_STELLAR_RPC_URL;
 */
export const env: Readonly<EnvSchema> = buildEnvConfig();
