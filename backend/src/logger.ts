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
 */
export * from './lib/logger';
export { logger as default } from './lib/logger';

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
