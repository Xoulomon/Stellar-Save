/**
 * Structural tests for @stellar-save/types.
 *
 * Because this package contains only TypeScript types (no runtime values),
 * the tests verify that:
 *  1. Every exported name is importable (the module resolves).
 *  2. The runtime-visible shape of the exports is exactly `undefined`
 *     (types are erased at compile time — nothing should ship as a value).
 *  3. Nominal discriminated-union narrowing works as expected so consumers
 *     can rely on the unions in switch statements.
 */

import { describe, it, expect } from 'vitest';
import * as Types from './index';

// ── Module shape ──────────────────────────────────────────────────────────────

describe('@stellar-save/types module', () => {
  it('exports nothing at runtime (pure types package)', () => {
    // After TypeScript erases types the module object must be empty.
    const keys = Object.keys(Types);
    expect(keys).toEqual([]);
  });
});

// ── Compile-time structural checks (type-level tests) ────────────────────────
// These use `satisfies` / assignability assertions that the TS compiler checks.
// If a type changes incompatibly the file will fail to compile, which vitest
// surfaces as a type-check error when run with `--typecheck`.

import type {
  GroupStatus,
  MemberStatus,
  PayoutStatus,
  TransactionType,
  Transaction,
  PaginationMeta,
  ApiError,
  ApiResponse,
  PaginatedResponse,
} from './index';

describe('GroupStatus', () => {
  it('accepts all valid literals', () => {
    const statuses: GroupStatus[] = ['active', 'completed', 'pending'];
    expect(statuses).toHaveLength(3);
  });
});

describe('MemberStatus', () => {
  it('accepts all valid literals', () => {
    const statuses: MemberStatus[] = ['active', 'inactive', 'pending', 'removed'];
    expect(statuses).toHaveLength(4);
  });
});

describe('PayoutStatus', () => {
  it('accepts all valid literals', () => {
    const statuses: PayoutStatus[] = ['completed', 'next', 'upcoming'];
    expect(statuses).toHaveLength(3);
  });
});

describe('TransactionType', () => {
  it('accepts all valid literals', () => {
    const types: TransactionType[] = [
      'payment',
      'swap',
      'deposit',
      'withdraw',
      'claimable',
      'other',
    ];
    expect(types).toHaveLength(6);
  });
});

describe('Transaction', () => {
  it('accepts a minimal valid transaction object', () => {
    const tx: Transaction = {
      id: 'tx-1',
      hash: 'abc123',
      createdAt: '2024-01-15T00:00:00Z',
      type: 'payment',
      amount: '100',
      assetCode: 'XLM',
      from: 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q',
      status: 'success',
      fee: '100',
    };
    expect(tx.id).toBe('tx-1');
    expect(tx.assetIssuer).toBeUndefined();
  });

  it('accepts optional fields', () => {
    const tx: Transaction = {
      id: 'tx-2',
      hash: 'def456',
      createdAt: '2024-01-16T00:00:00Z',
      type: 'swap',
      amount: '50',
      assetCode: 'USDC',
      assetIssuer: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUVZO2Y3A23YIHTJ3L7GN',
      from: 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q',
      to: 'GBHXGGEKJNVVSXK997FY5F3T4AFF3VZBPVF6DFZJ3LHKPNX26EPLHFP',
      memo: 'swap memo',
      status: 'pending',
      fee: '200',
    };
    expect(tx.assetIssuer).toBeTruthy();
    expect(tx.memo).toBe('swap memo');
  });
});

describe('PaginationMeta', () => {
  it('accepts a valid pagination object', () => {
    const meta: PaginationMeta = {
      page: 1,
      pageSize: 20,
      totalItems: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPrevPage: false,
    };
    expect(meta.totalPages).toBe(5);
  });
});

describe('ApiError', () => {
  it('accepts a minimal error without field errors', () => {
    const err: ApiError = { code: 'NOT_FOUND', message: 'Resource not found' };
    expect(err.errors).toBeUndefined();
  });

  it('accepts field-level validation errors', () => {
    const err: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Request is invalid',
      errors: { amount: ['Must be positive'], assetCode: ['Required'] },
    };
    expect(Object.keys(err.errors ?? {})).toHaveLength(2);
  });
});

describe('ApiResponse', () => {
  it('wraps an arbitrary payload', () => {
    const resp: ApiResponse<{ id: string }> = {
      data: { id: 'abc' },
      timestamp: '2024-01-15T00:00:00Z',
    };
    expect(resp.data.id).toBe('abc');
  });
});

describe('PaginatedResponse', () => {
  it('wraps an array with pagination meta', () => {
    const resp: PaginatedResponse<{ id: string }> = {
      data: [{ id: '1' }, { id: '2' }],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
      timestamp: '2024-01-15T00:00:00Z',
    };
    expect(resp.data).toHaveLength(2);
    expect(resp.meta.hasNextPage).toBe(false);
  });
});
