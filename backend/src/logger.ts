/**
 * Backwards-compatible re-export.
 *
 * The structured logger implementation now lives in `src/lib/logger.ts`
 * (see issue #40). This shim keeps existing `import { logger } from './logger'`
 * call sites working; new code should import from `./lib/logger`.
 */
export * from './lib/logger';
export { logger as default } from './lib/logger';
