import type { ApiTransaction, SdkTransactionLike } from './types';

let apiTransactionCounter = 0;

/** Backend-shaped transaction (matches backend/src/mock_data.ts mockTransactions exactly). */
export function buildApiTransaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  apiTransactionCounter += 1;
  return {
    id: `t${apiTransactionCounter}`,
    groupId: '1',
    memberAddress: 'G...ALICE',
    amount: 100,
    type: 'contribution',
    timestamp: Date.now(),
    stellarTxHash: `hash${apiTransactionCounter}...`,
    ...overrides,
  };
}

/**
 * Canonical set of backend transactions. Values intentionally match
 * backend/src/mock_data.ts's mockTransactions so the two stay identical;
 * the contract test asserts this on every run.
 */
export const mockApiTransactions: ApiTransaction[] = [
  { id: 't1', groupId: '1', memberAddress: 'G...ALICE', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash1...' },
  { id: 't2', groupId: '1', memberAddress: 'G...BOB', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash2...' },
];

let sdkTransactionCounter = 0;

/** Frontend/SDK-shaped transaction (matches @stellar-save/sdk Transaction). */
export function buildSdkTransaction(overrides: Partial<SdkTransactionLike> = {}): SdkTransactionLike {
  sdkTransactionCounter += 1;
  return {
    id: String(sdkTransactionCounter),
    hash: `abc${sdkTransactionCounter}`,
    createdAt: '2026-03-15T10:00:00Z',
    type: 'deposit',
    amount: '+100',
    assetCode: 'XLM',
    from: 'GABC',
    to: 'GDEF',
    memo: 'test memo',
    status: 'success',
    fee: '0.00001',
    ...overrides,
  };
}
