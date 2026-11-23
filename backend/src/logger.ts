/**
 * Backwards-compatible re-export.
 *
 * The structured logger implementation now lives in `src/lib/logger.ts`
 * (see issue #40). This shim keeps existing `import { logger } from './logger'`
 * call sites working; new code should import from `./lib/logger`.
 *
 * Request correlation (issue #1889): the logger automatically attaches the
 * current request ID and trace ID from async context to every log line.
 * Use `runWithRequestContext` / `getRequestContext` to populate that context
 * from middleware, and `getPropagationHeaders` to forward it on outgoing calls.
 *
 * Structured logging (issue #2053): ad-hoc `console.*` calls should be replaced
 * with the structured `logger` below. Use `createLogger(scope)` to obtain a
 * child logger bound to a module/component name so log lines carry a stable
 * `scope` field instead of interpolated strings.
 */
export * from './lib/logger';
export { logger as default } from './lib/logger';

import { logger as baseLogger } from './lib/logger';

/**
 * Create a child logger bound to a module/component scope.
 *
 * Prefer this over ad-hoc `console.log`/`console.error` calls so that every
 * log line is structured (level, message, scope, request/trace context) and
 * can be filtered or shipped consistently.
 *
 * @example
 *   const log = createLogger('payments');
 *   log.info('charge created', { chargeId });
 */
export function createLogger(scope: string) {
  return baseLogger.child({ scope });
}

// Request correlation helpers are consolidated in `lib/requestContext` so that
// there is a single AsyncLocalStorage instance shared across the codebase.
// Re-exported here to keep existing `import { ... } from './logger'` call sites
// working; new code should import from `./lib/requestContext` directly.
export {
  runWithRequestContext,
  getRequestContext,
  getPropagationHeaders,
} from './lib/requestContext';
export type { RequestContext } from './lib/requestContext';
