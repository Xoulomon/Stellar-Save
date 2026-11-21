import { describe, it, expect } from 'vitest';
import { groupTransactionsByDate } from '../utils/groupTransactionsByDate';
import type { Transaction } from '../types/transaction';

function makeTx(id: string, createdAt: string): Transaction {
  return {
    id,
    hash: `hash-${id}`,
    createdAt,
    type: 'payment',
    amount: '100',
    assetCode: 'XLM',
    from: 'GABC...',
    to: 'GDEF...',
    status: 'success',
    fee: '0.00001',
  };
}

describe('groupTransactionsByDate', () => {
  it('groups transactions by local date', () => {
    const txs: Transaction[] = [
      makeTx('1', '2026-04-20T10:00:00Z'),
      makeTx('2', '2026-04-20T14:30:00Z'),
      makeTx('3', '2026-04-19T08:00:00Z'),
    ];

    const grouped = groupTransactionsByDate(txs);
    expect(grouped.length).toBe(2);
    expect(grouped[0].transactions.length).toBe(2);
    expect(grouped[1].transactions.length).toBe(1);
  });

  it('handles empty transaction list', () => {
    const grouped = groupTransactionsByDate([]);
    expect(grouped).toEqual([]);
  });

  it('groups transactions accurately across timezone boundaries', () => {
    // 23:59 UTC on day 1 vs 00:01 UTC on day 2
    const txs: Transaction[] = [
      makeTx('1', '2026-04-20T23:59:00Z'),
      makeTx('2', '2026-04-21T00:01:00Z'),
    ];

    const grouped = groupTransactionsByDate(txs);
    const allTxs = grouped.flatMap((g) => g.transactions);
    expect(allTxs.length).toBe(2);
    expect(allTxs.map((t) => t.id)).toEqual(['1', '2']);
  });
});
