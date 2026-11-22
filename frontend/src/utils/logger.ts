/**
 * logger.ts — Backwards-compatible re-export
 *
 * The single logger implementation now lives in `frontend/src/lib/logger.ts`.
 * This module is kept only so existing imports from `utils/logger` continue to
 * work. New code should import from `lib/logger` directly.
 *
 * Usage:
 * ```ts
 * import { logger } from '../lib/logger';
 *
 * logger.debug('Fetching balance for', address);
 * logger.info('Group created', { groupId });
 * logger.warn('Horizon returned empty records');
 * logger.error('Failed to submit transaction', err);
 * ```
 */

export { logger, default } from '../lib/logger';
