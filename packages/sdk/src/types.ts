/**
 * Shared domain types consumed by the frontend and mobile apps.
 * These mirror the on-chain contract data structures and REST API shapes.
 */

// ── Groups ────────────────────────────────────────────────────────────────────

export type GroupStatus = 'active' | 'completed' | 'pending';

// ── Members ───────────────────────────────────────────────────────────────────

export type MemberStatus = 'active' | 'inactive' | 'pending' | 'removed';

// ── Payouts ───────────────────────────────────────────────────────────────────

export type PayoutStatus = 'completed' | 'next' | 'upcoming';

// ── Transactions ──────────────────────────────────────────────────────────────

export type TransactionType = 'payment' | 'swap' | 'deposit' | 'withdraw' | 'claimable' | 'other';

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
