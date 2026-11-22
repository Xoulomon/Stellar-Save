/**
 * Shared validation middleware and schemas (#40).
 *
 * Consolidates duplicate inline validation logic scattered across route handlers
 * into reusable Zod schemas and Express middleware factories.
 *
 * Usage:
 *   import { validateBody, validateQuery, schemas } from '../lib/validation';
 *
 *   router.post('/groups', validateBody(schemas.createGroup), handler);
 *   router.get('/groups', validateQuery(schemas.pagination), handler);
 */

import { z } from 'zod';

import { AppError } from './errors';

import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

// ── Primitive / reusable schemas ─────────────────────────────────────────────

/** Stellar public key: 56-character base32 G… address */
const stellarAddress = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar wallet address');

/** Positive integer (≥ 1) */
const positiveInt = z.coerce.number().int().positive();

/** Non-negative integer (≥ 0) */
const nonNegativeInt = z.coerce.number().int().min(0);

/** Amount: positive number, max 15 decimal places */
const amount = z.coerce
  .number()
  .positive('Amount must be positive')
  .max(1_000_000_000, 'Amount exceeds maximum allowed value');

/** Pagination: limit (1–100) and offset (≥ 0) */
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: nonNegativeInt.default(0),
});

/** Cursor-based pagination */
const cursorQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/** Member count: 2–20 members per group */
const memberCount = z.coerce
  .number()
  .int()
  .min(2, 'Group must have at least 2 members')
  .max(20, 'Group cannot exceed 20 members');

// ── Domain schemas ────────────────────────────────────────────────────────────

const createGroup = z.object({
  contributionAmount: amount,
  cycleDuration: positiveInt.describe('Cycle duration in seconds'),
  maxMembers: memberCount,
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
});

const joinGroup = z.object({
  walletAddress: stellarAddress,
});

const contribute = z.object({
  walletAddress: stellarAddress,
  amount,
});

const exportJob = z.object({
  userId: z.string().trim().min(1),
  email: z.string().email('Invalid email address'),
  format: z.enum(['CSV', 'JSON']),
});

const analyticsEventBody = z.object({
  eventType: z.string().trim().min(1),
  eventName: z.string().trim().min(1),
  userId: z.string().optional(),
  groupId: z.string().optional(),
  sessionId: z.string().optional(),
  eventData: z.record(z.string(), z.unknown()).optional(),
});

const analyticsReport = z.object({
  reportType: z.string().trim().min(1),
  reportName: z.string().trim().min(1),
  startDate: z.string().datetime({ message: 'startDate must be an ISO 8601 datetime' }),
  endDate: z.string().datetime({ message: 'endDate must be an ISO 8601 datetime' }),
  generatedBy: z.string().optional(),
});

const authChallenge = z.object({
  walletAddress: stellarAddress,
});

const authVerify = z.object({
  walletAddress: stellarAddress,
  challenge: z.string().trim().min(1),
  signature: z.string().trim().min(1),
});

const authRefresh = z.object({
  refreshToken: z.string().trim().min(1),
});

const backupTrigger = z.object({
  type: z.enum(['full', 'incremental']),
});

const webhookCreate = z.object({
  userId: z.string().trim().min(1),
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1),
});

const notificationPreferences = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  contributionReminders: z.boolean().optional(),
  groupUpdates: z.boolean().optional(),
  payoutNotifications: z.boolean().optional(),
  emailFrequency: z.enum(['immediate', 'daily', 'weekly', 'never']).optional(),
});

const dateRangeQuery = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ── Issue #1693: Query Parameter Schemas ──────────────────────────────────────

/**
 * Analytics date query: optional ISO 8601 date parameter.
 * Used for: GET /analytics/platform, GET /analytics/users/:userId, GET /analytics/groups/:groupId
 */
const analyticsDateQuery = z.object({
  date: z
    .string()
    .datetime({ message: 'date must be an ISO 8601 datetime' })
    .optional(),
});

/**
 * Search query: required search string with length constraints.
 * Used for: GET /search, GET /search/autocomplete
 */
const searchQuery = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be 200 characters or less'),
});

/**
 * Contract events filter query: complex filtering for blockchain events.
 * Used for: GET /events
 * Supports filtering by contract, event type, ledger range, and timestamp range.
 */
const eventsFilterQuery = z.object({
  contractId: z.string().trim().optional(),
  eventType: z.string().trim().optional(),
  startLedger: z.coerce.number().int().min(0).optional(),
  endLedger: z.coerce.number().int().min(0).optional(),
  startTime: z
    .string()
    .datetime({ message: 'startTime must be an ISO 8601 datetime' })
    .optional(),
  endTime: z
    .string()
    .datetime({ message: 'endTime must be an ISO 8601 datetime' })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Pagination query with optional date range.
 * Used for: GET /analytics/events, GET /analytics/reports
 */
const paginationWithDateRange = z.object({
  startDate: z
    .string()
    .datetime({ message: 'startDate must be an ISO 8601 datetime' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be an ISO 8601 datetime' })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Cache pattern for cache operations.
 * Used for: POST /analytics/cache/clear
 */
const cachePattern = z.object({
  pattern: z.string().trim().default('*'),
});

/**
 * User preferences update body.
 * Used for: POST /preferences
 */
const userPreferenceUpdate = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  contributionReminders: z.boolean().optional(),
  groupUpdates: z.boolean().optional(),
  payoutNotifications: z.boolean().optional(),
  emailFrequency: z.enum(['immediate', 'daily', 'weekly', 'never']).optional(),
});

// ── Issue #1693: Path Parameter Schemas ──────────────────────────────────────

/**
 * ID parameter validation (generic for jobId, alertId, etc.).
 * Accepts any non-empty string (UUIDs, slugs, numeric IDs all supported).
 */
const idParam = z.object({
  id: z.string().trim().min(1, 'ID is required'),
});

const jobIdParam = z.object({
  jobId: z.string().trim().min(1, 'jobId is required'),
});

const groupIdParam = z.object({
  groupId: z.string().trim().min(1, 'groupId is required'),
});

const userIdParam = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
});

const alertIdParam = z.object({
  alertId: z.string().trim().min(1, 'alertId is required'),
});

const addressParam = z.object({
  address: stellarAddress,
});

// ── Issue #1693: Additional Admin/Backup Body Schemas ───────────────────────

/**
 * Admin user update body: `updates` object and `adminId` for audit trail.
 * Used for: PATCH /admin/users/:id
 */
const adminUserUpdate = z.object({
  updates: z.record(z.unknown()).refine(
    (val) => Object.keys(val).length >= 1,
    { message: 'updates must contain at least one field' }
  ),
  adminId: z.string().trim().min(1, 'adminId is required'),
});

/**
 * Admin group flag body: `flagged` boolean and `adminId` for audit.
 * Used for: POST /admin/groups/:id/flag
 */
const adminGroupFlag = z.object({
  flagged: z.boolean(),
  adminId: z.string().trim().min(1, 'adminId is required'),
});

/**
 * Admin user delete body: `adminId` for audit trail.
 * Used for: DELETE /admin/users/:id
 */
const adminUserDelete = z.object({
  adminId: z.string().trim().min(1, 'adminId is required'),
});

/**
 * Backup restore body: optional `jobId` to restore specific backup or latest.
 * Used for: POST /backup/restore
 */
const backupRestore = z.object({
  jobId: z.string().trim().optional(),
});

/**
 * API key creation body: userId, optional name, optional tier.
 * Used for: POST /api-keys
 */
const apiKeyCreate = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  name: z.string().trim().min(1).max(100).optional(),
  tier: z.enum(['free', 'pro', 'enterprise']).optional(),
});

/**
 * Key ID parameter.
 */
const keyIdParam = z.object({
  keyId: z.string().trim().min(1, 'keyId is required'),
});

/** All named schemas, exported for route use */
export const schemas = {
  // Auth
  authChallenge,
  authVerify,
  authRefresh,
  // Groups
  createGroup,
  joinGroup,
  contribute,
  // Export
  exportJob,
  // Analytics
  analyticsEventBody,
  analyticsReport,
  analyticsDateQuery,
  dateRangeQuery,
  paginationWithDateRange,
  // Analytics Cache
  cachePattern,
  // Search
  searchQuery,
  // Events
  eventsFilterQuery,
  // Backup
  backupTrigger,
  backupRestore,
  // Webhooks
  webhookCreate,
  // Notifications
  notificationPreferences,
  userPreferenceUpdate,
  // Admin
  adminUserUpdate,
  adminGroupFlag,
  adminUserDelete,
  // API Keys
  apiKeyCreate,
  // Shared
  paginationQuery,
  cursorQuery,
  memberCount,
  amount,
  stellarAddress,
  // Path Parameters
  idParam,
  jobIdParam,
  groupIdParam,
  userIdParam,
  alertIdParam,
  addressParam,
  keyIdParam,
};

// ── Middleware factories ───────────────────────────────────────────────────────

type ValidatedInput<T extends ZodTypeAny> = z.infer<T>;

/**
 * Returns Express middleware that parses `req.body` against `schema`.
 * On success, replaces `req.body` with the typed, coerced value.
 * On failure, calls `next(AppError)` with status 400 and a human-readable message.
 */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = (result.error.issues as Array<{ path: (string | number)[]; message: string }>)
        .map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
        .join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }
    req.body = result.data as ValidatedInput<T>;
    next();
  };
}

/**
 * Returns Express middleware that parses `req.query` against `schema`.
 * On success, attaches `.validatedQuery` to the request.
 * On failure, calls `next(AppError)` with status 400.
 */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (
    req: Request & { validatedQuery?: ValidatedInput<T> },
    _res: Response,
    next: NextFunction
  ): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = (result.error.issues as Array<{ path: (string | number)[]; message: string }>)
        .map((e) => `${e.path.join('.') || 'query'}: ${e.message}`)
        .join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }
    req.validatedQuery = result.data as ValidatedInput<T>;
    next();
  };
}

/**
 * Returns Express middleware that parses `req.params` against `schema`.
 * On failure, calls `next(AppError)` with status 400.
 */
export function validateParams<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const message = (result.error.issues as Array<{ path: (string | number)[]; message: string }>)
        .map((e) => `${e.path.join('.') || 'params'}: ${e.message}`)
        .join('; ');
      return next(new AppError('VALIDATION_ERROR', message, 400));
    }
    Object.assign(req.params, result.data);
    next();
  };
}
