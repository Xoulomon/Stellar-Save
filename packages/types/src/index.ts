/**
 * @stellar-save/types
 *
 * Zero-dependency package containing every domain type shared between the
 * backend, frontend, and mobile workspaces.
 *
 * Rules:
 *  - No runtime values (no functions, no classes, no constants).
 *    Pure `type` / `interface` / `enum` exports only.
 *  - No imports from other workspace packages; this package must stay
 *    at the root of the dependency graph.
 *  - Add a new file under src/ and re-export it from this index when a
 *    new domain area needs shared types.
 */

export type {
  GroupStatus,
  MemberStatus,
  PayoutStatus,
  TransactionType,
  Transaction,
  PaginationMeta,
} from './domain';

export type { ApiError, ApiResponse, PaginatedResponse } from './api';
