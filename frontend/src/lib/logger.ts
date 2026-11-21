/**
 * Frontend logger.
 *
 * Single entry point for all frontend logging. Provides level filtering,
 * silences debug/info output in production builds, and redacts sensitive
 * values (wallet addresses, transaction payloads) before they reach the
 * console.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('...');
 *   logger.info('...');
 *   logger.warn('...');
 *   logger.error('...');
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Determine whether we are running in a production build.
 * Falls back to `false` when `import.meta` is unavailable (e.g. in tests
 * running under a non-Vite environment).
 */
function isProduction(): boolean {
  try {
    // Vite exposes import.meta.env.PROD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    if (env && typeof env.PROD === 'boolean') {
      return env.PROD;
    }
    if (env && typeof env.MODE === 'string') {
      return env.MODE === 'production';
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Resolve the minimum level that should be emitted.
 * - In production: only `warn` and `error` are emitted (debug/info stripped).
 * - Otherwise: honour an explicit override via `VITE_LOG_LEVEL`, defaulting
 *   to `debug`.
 */
function resolveMinLevel(): LogLevel {
  const prod = isProduction();

  let configured: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configured = (import.meta as any)?.env?.VITE_LOG_LEVEL;
  } catch {
    configured = undefined;
  }

  if (configured && configured in LEVEL_PRIORITY) {
    const level = configured as LogLevel;
    // Never allow debug/info below the production floor.
    if (prod && LEVEL_PRIORITY[level] < LEVEL_PRIORITY.warn) {
      return 'warn';
    }
    return level;
  }

  return prod ? 'warn' : 'debug';
}

let minLevel: LogLevel = resolveMinLevel();

/** Override the minimum log level (primarily for tests). */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** Reset the minimum log level to the environment-derived default. */
export function resetLogLevel(): void {
  minLevel = resolveMinLevel();
}

/** Returns true if a message at `level` would be emitted. */
export function isLevelEnabled(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const REDACTED = '[REDACTED]';

/** Keys whose values are considered wallet addresses. */
const ADDRESS_KEY_PATTERN = /(address|wallet|account|pubkey|publickey|owner|from|to|recipient|sender)/i;

/** Keys whose values are considered transaction payloads. */
const PAYLOAD_KEY_PATTERN = /(payload|tx|transaction|rawtx|signedtx|signature|data|body|calldata|input)/i;

/** Heuristic: looks like a hex/base58-ish wallet address or hash. */
const ADDRESS_VALUE_PATTERN = /^(0x)?[0-9a-fA-F]{20,}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Truncate a wallet address to its first and last few characters.
 * e.g. `0x1234...abcd`
 */
export function truncateAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 10) {
    return trimmed;
  }
  const prefixLen = trimmed.startsWith('0x') ? 6 : 4;
  const suffixLen = 4;
  return `${trimmed.slice(0, prefixLen)}...${trimmed.slice(-suffixLen)}`;
}

/**
 * Redact a transaction payload. Payloads are never logged in full; we only
 * expose a short fingerprint (length + truncated prefix) so logs remain
 * useful for correlation without leaking contents.
 */
export function redactPayload(payload: unknown): string {
  if (payload == null) {
    return String(payload);
  }
  let serialized: string;
  try {
    serialized =
      typeof payload === 'string' ? payload : JSON.stringify(payload) ?? String(payload);
  } catch {
    return '[Unserializable payload]';
  }
  const fingerprint = serialized.slice(0, 8);
  return `[Payload len=${serialized.length} prefix=${fingerprint}...]`;
}

/**
 * Recursively redact sensitive values from a value before logging.
 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    if (ADDRESS_VALUE_PATTERN.test(value)) {
      return truncateAddress(value);
    }
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (PAYLOAD_KEY_PATTERN.test(key)) {
      result[key] = redactPayload(val);
    } else if (ADDRESS_KEY_PATTERN.test(key) && typeof val === 'string') {
      result[key] = truncateAddress(val);
    } else {
      result[key] = redact(val, seen);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

function emit(level: LogLevel, args: unknown[]): void {
  if (!isLevelEnabled(level)) {
    return;
  }

  const redactedArgs = args.map((arg) => redact(arg));

  // Route to the appropriate console method. `console.log` is intentionally
  // avoided here so that this module is the single place that talks to the
  // console.
  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(...redactedArgs);
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(...redactedArgs);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(...redactedArgs);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(...redactedArgs);
      break;
  }
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export const logger: Logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

export default logger;