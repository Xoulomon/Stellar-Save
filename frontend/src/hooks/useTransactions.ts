import { useState, useEffect } from 'react';
import type { Transaction } from '../types/transaction';

// Mock data - Replace with real Stellar Horizon API later
const mockTransactions: Transaction[] = [
  {
    id: '1',
    hash: '0xabc123def456...',
    createdAt: '2026-03-20T10:30:00Z',
    type: 'deposit',
    amount: '+250',
    assetCode: 'XLM',
    from: 'GBQ...',
    to: 'GAB...',
    memo: 'Group contribution',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '2',
    hash: '0xdef456ghi789...',
    createdAt: '2026-03-19T14:22:00Z',
    type: 'payment',
    amount: '-45.50',
    assetCode: 'USDC',
    from: 'GAB...',
    to: 'GCX...',
    memo: '',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '3',
    hash: '0xghi789jkl012...',
    createdAt: '2026-03-18T09:15:00Z',
    type: 'withdraw',
    amount: '-120',
    assetCode: 'XLM',
    from: 'GAB...',
    memo: 'Personal withdrawal',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '4',
    hash: '0xjkl012mno345...',
    createdAt: '2026-03-17T16:45:00Z',
    type: 'swap',
    amount: '-30',
    assetCode: 'XLM',
    from: 'GAB...',
    to: 'GCX...',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '5',
    hash: '0xmno345pqr678...',
    createdAt: '2026-03-16T11:20:00Z',
    type: 'claimable',
    amount: '+15.75',
    assetCode: 'USDC',
    from: 'GCX...',
    memo: 'Reward claim',
    status: 'pending',
    fee: '0.00001',
  },
];

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API delay
    const timer = setTimeout(() => {
      setTransactions(mockTransactions);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return { transactions, isLoading };
};