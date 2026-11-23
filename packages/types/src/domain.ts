/**
 * Core domain types that mirror on-chain contract data structures and the REST
 * API response shapes consumed by both frontend and mobile.
 *
 * These types were previously defined only in packages/sdk/src/types.ts.
 * They now live here so the backend can import them without pulling in the
 * Stellar SDK peer-dependency or any browser-specific code.
 */

// ── Groups ────────────────────────────────────────────────────────────────────

export type GroupStatus = 'active' | 'completed' | 'pending';

// ── Members ───────────────────────────────────────────────────────────────────

export type MemberStatus = 'active' | 'inactive' | 'pending' | 'removed';

// ── Payouts ───────────────────────────────────────────────────────────────────

export type PayoutStatus = 'completed' | 'next' | 'upcoming';

// ── Transactions ──────────────────────────────────────────────────────────────

export type TransactionType =
  | 'payment'
  | 'swap'
  | 'deposit'
  | 'withdraw'
  | 'claimable'
  | 'other';

export interface Transaction {
  id: string;
  hash: string;
  createdAt: string;
  type: TransactionType;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  from: string;
  to?: string;
  memo?: string;
  status: 'success' | 'pending' | 'failed';
  fee: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
