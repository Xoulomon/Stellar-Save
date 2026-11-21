import type { Transaction } from '../types/transaction';

export interface TransactionGroup {
  date: string;
  transactions: Transaction[];
}

/**
 * Groups an array of transactions by their local calendar date.
 * Timezone-aware: uses the locale date string for grouping.
 */
export function groupTransactionsByDate(transactions: Transaction[]): TransactionGroup[] {
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const date = new Date(tx.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const group = groups.get(date) ?? [];
    group.push(tx);
    groups.set(date, group);
  }

  return Array.from(groups.entries()).map(([date, transactions]) => ({ date, transactions }));
}
