/**
 * Test factory for Transaction type from @stellar-save/sdk.
 */

import type { Transaction } from '@stellar-save/sdk';

/**
 * Create a `Transaction` fixture with defaults. Override any field via `overrides`.
 */
export function makeTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    hash: 'abc123txhashdef456ghi789',
    createdAt: '2026-01-20T10:30:00Z',
    type: 'payment',
    amount: '100.0000000',
    assetCode: 'XLM',
    from: 'GASEND1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF',
    to: 'GARECV1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF',
    status: 'success',
    fee: '0.00001',
    ...overrides,
  };
}
