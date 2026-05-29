import { useState, useEffect } from 'react';
import type { DashboardStats, DashboardGroup, PayoutItem, Transaction } from '../types/dashboard';

const mockStats: DashboardStats = {
  totalBalance: 12_450,
  nextPayoutAmount: 5_000,
  nextPayoutDate: 'May 15, 2026',
  currency: 'XLM',
};

const mockGroups: DashboardGroup[] = [
  { id: '1', name: 'Family Savings Circle', currentCycle: 4, totalCycles: 10, contributionAmount: 500, currency: 'XLM', status: 'active' },
  { id: '2', name: 'Vacation Fund', currentCycle: 2, totalCycles: 6, contributionAmount: 250, currency: 'XLM', status: 'active' },
  { id: '3', name: 'Emergency Reserve', currentCycle: 8, totalCycles: 8, contributionAmount: 300, currency: 'XLM', status: 'completed' },
  { id: '4', name: 'Business Startup', currentCycle: 1, totalCycles: 12, contributionAmount: 1000, currency: 'XLM', status: 'pending' },
];

const mockPayouts: PayoutItem[] = [
  { id: '1', groupName: 'Family Savings Circle', amount: 5000, date: 'May 15, 2026', status: 'upcoming' },
  { id: '2', groupName: 'Vacation Fund', amount: 1500, date: 'Jun 1, 2026', status: 'upcoming' },
  { id: '3', groupName: 'Emergency Reserve', amount: 2400, date: 'Apr 10, 2026', status: 'received' },
];

const mockTransactions: Transaction[] = [
  { id: '1', type: 'deposit', amount: 500, currency: 'XLM', date: 'Apr 22, 2026', status: 'paid' },
  { id: '2', type: 'payout', amount: 2400, currency: 'XLM', date: 'Apr 10, 2026', status: 'paid' },
  { id: '3', type: 'deposit', amount: 250, currency: 'XLM', date: 'Apr 8, 2026', status: 'paid' },
  { id: '4', type: 'fee', amount: 0.5, currency: 'XLM', date: 'Apr 8, 2026', status: 'paid' },
  { id: '5', type: 'deposit', amount: 1000, currency: 'XLM', date: 'Apr 1, 2026', status: 'pending' },
  { id: '6', type: 'withdrawal', amount: 300, currency: 'XLM', date: 'Mar 28, 2026', status: 'paid' },
];

export interface DashboardData {
  stats: DashboardStats;
  groups: DashboardGroup[];
  payouts: PayoutItem[];
  transactions: Transaction[];
  isLoading: boolean;
}

export const useDashboard = (): DashboardData => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1400);
    return () => clearTimeout(t);
  }, []);

  return { stats: mockStats, groups: mockGroups, payouts: mockPayouts, transactions: mockTransactions, isLoading };
};
