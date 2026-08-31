/**
 * logger.ts — Debug logger utility
 *
 * Replaces direct `console.log` calls throughout the application with a
 * structured logger that:
 * - Is completely silent in production (`VITE_APP_ENV !== 'development'`)
 * - Prefixes all messages with a `[StellarSave]` tag for easy filtering
 * - Provides `debug`, `info`, `warn`, and `error` levels
 * - Respects the ESLint `no-console` rule (only `warn` and `error` are
 *   used in production code; `debug`/`info` are stripped at build time via
 *   the guard below)
 *
 * Usage:
 * ```ts
 * import { logger } from '../utils/logger';
 *
 * logger.debug('Fetching balance for', address);
 * logger.info('Group created', { groupId });
 * logger.warn('Horizon returned empty records');
 * logger.error('Failed to submit transaction', err);
 * ```
 *
 * The `debug` and `info` methods are no-ops in production.
 * The `warn` and `error` methods always forward to `console.warn` / `console.error`
 * since those are permitted by the ESLint `no-console` rule.
 */

const PREFIX = '[StellarSave]';
const IS_DEV = import.meta.env['DEV'] === true || import.meta.env['MODE'] === 'development';

function fmt(level: string, ...args: unknown[]): unknown[] {
  return [`${PREFIX}[${level}]`, ...args];
}

export const logger = {
  /**
   * Debug-level log — only emitted in development mode.
   * Use for verbose diagnostic output that should never reach production.
   */
  debug(...args: unknown[]): void {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log(...fmt('DEBUG', ...args));
    }
  },

  /**
   * Info-level log — only emitted in development mode.
   * Use for notable lifecycle events (fetch started, component mounted, etc.)
   */
  info(...args: unknown[]): void {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log(...fmt('INFO', ...args));
    }
  },

  /**
   * Warning log — always emitted.
   * Use for recoverable problems (e.g. falling back to cached data).
   */
  warn(...args: unknown[]): void {
    console.warn(...fmt('WARN', ...args));
  },

  /**
   * Error log — always emitted.
   * Use for unrecoverable errors or unexpected exceptions.
   */
  error(...args: unknown[]): void {
    console.error(...fmt('ERROR', ...args));
  },
} as const;

export default logger;
