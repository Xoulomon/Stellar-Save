import { useState, useEffect } from 'react';
import { Horizon } from '@stellar/stellar-sdk';
import { useWallet } from './useWallet';
import type { Transaction } from '../types/transaction';

export interface UserStats {
  totalContributed: number;
  totalReceived: number;
  groupsJoined: number;
  activeGroups: number;
  completedCycles: number;
  averageContribution: number;
}

export interface UserProfile {
  address: string;
  name: string;
  joinDate: Date;
  stats: UserStats;
  timeline: Transaction[];
}

function getHorizonServer(network?: string) {
  if (network === 'PUBLIC' || network === 'MAINNET') {
    return new Horizon.Server('https://horizon.stellar.org');
  }

  if (network === 'testnet' || network === 'TESTNET') {
    return new Horizon.Server('https://horizon-testnet.stellar.org');
  }

  return new Horizon.Server('https://horizon-testnet.stellar.org');
}

function parseAmount(value: string | number | undefined) {
  if (value === undefined || value === null) {
    return 0;
  }

  return Number(value.toString()) || 0;
}

function parseHorizonRecord(record: any, address: string): Transaction | null {
  const amount = record.amount ?? record.source_amount ?? record.sent_amount ?? record.total_sent_amount ?? '0';
  const parsedAmount = parseAmount(amount);

  if (parsedAmount === 0 && record.type !== 'account_merge') {
    return null;
  }

  const isOutgoing = record.from?.toString() === address;

  const assetCode = record.asset_type === 'native'
    ? 'XLM'
    : record.asset_code || record.asset?.code || 'UNKNOWN';

  const signedAmount = `${isOutgoing ? '-' : '+'}${Math.abs(parsedAmount)}`;

  return {
    id: record.id || record.transaction_hash || `${record.transaction_hash}-${record.id}`,
    hash: record.transaction_hash || record.id || '',
    createdAt: record.created_at || new Date().toISOString(),
    type: ['payment', 'path_payment_strict_receive', 'path_payment_strict_send'].includes(record.type)
      ? 'payment'
      : 'other',
    amount: signedAmount,
    assetCode,
    from: record.from || 'Unknown',
    to: record.to || 'Unknown',
    memo: record.transaction_memo || record.memo || '',
    status: 'success',
    fee: '0.0000000',
  };
}

function computeStats(address: string, timeline: Transaction[]): UserStats {
  const contributions = timeline.filter((tx) => tx.from === address && Number(tx.amount) < 0);
  const payouts = timeline.filter((tx) => tx.to === address && Number(tx.amount) > 0);

  const totalContributed = contributions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const totalReceived = payouts.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

  const groupsJoined = new Set(contributions.filter((tx) => tx.to).map((tx) => tx.to)).size;
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const activeGroups = new Set(
    contributions
      .filter((tx) => new Date(tx.createdAt).getTime() >= cutoff)
      .filter((tx) => tx.to)
      .map((tx) => tx.to)
  ).size;

  const completedCycles = payouts.length;
  const averageContribution = contributions.length > 0 ? totalContributed / contributions.length : 0;

  return {
    totalContributed,
    totalReceived,
    groupsJoined,
    activeGroups,
    completedCycles,
    averageContribution,
  };
}

export const useUserProfile = (address?: string) => {
  const { network } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchProfile() {
      if (!address) {
        setProfile(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const server = getHorizonServer(network);
        const page = await server.payments().forAccount(address).order('desc').limit(100).call();
        const records = page.records || [];

        const timeline = records
          .map((record: any) => parseHorizonRecord(record, address))
          .filter((tx: Transaction | null): tx is Transaction => tx !== null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const stats = computeStats(address, timeline);
        const joinDate = timeline.length > 0
          ? new Date(timeline[timeline.length - 1].createdAt)
          : new Date();

        if (!isCancelled) {
          setProfile({
            address,
            name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            joinDate,
            stats,
            timeline,
          });
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to fetch profile data');
          setIsLoading(false);
        }
      }
    }

    void fetchProfile();

    return () => {
      isCancelled = true;
    };
  }, [address, network]);

  return { profile, isLoading, error };
};
