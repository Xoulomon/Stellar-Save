import { useState, useEffect, useCallback, useRef } from 'react';

import { stellarService } from '../lib/stellarService';
import type { AccountBalance } from '../lib/stellarService';
import { useWallet } from './useWallet';

export type { AccountBalance as Balance };

export interface BalanceState {
  xlmBalance: string | null;
  allBalances: AccountBalance[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseBalanceOptions {
  /**
   * Auto-refresh interval in milliseconds
   * Set to 0 to disable auto-refresh
   * @default 30000 (30 seconds)
   */
  refreshInterval?: number;

  /**
   * Whether to fetch balance immediately on mount
   * @default true
   */
  fetchOnMount?: boolean;
}

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Hook for fetching and managing Stellar account XLM balance.
 *
 * Delegates network calls to `stellarService` (not the SDK directly),
 * keeping the hook decoupled from `@stellar/stellar-sdk`.
 *
 * Features:
 * - Fetches XLM balance from Stellar Horizon API
 * - Auto-refresh with configurable interval
 * - Error handling with retry logic
 * - Loading states
 * - Manual refresh capability
 *
 * @param options - Configuration options for the hook
 * @returns Balance state and control functions
 *
 * @example
 * ```tsx
 * const { xlmBalance, isLoading, error, refresh } = useBalance({
 *   refreshInterval: 30000,
 *   fetchOnMount: true
 * });
 * ```
 */
export function useBalance(options: UseBalanceOptions = {}) {
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    fetchOnMount = true,
  } = options;

  const { activeAddress, network } = useWallet();

  const [state, setState] = useState<BalanceState>({
    xlmBalance: null,
    allBalances: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch balance via stellarService (no direct SDK imports).
   */
  const fetchBalance = useCallback(async () => {
    if (!activeAddress) {
      setState({
        xlmBalance: null,
        allBalances: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
      return;
    }

    setState((prev: BalanceState) => ({ ...prev, isLoading: true, error: null }));

    try {
      const allBalances = await stellarService.getAllBalances(
        activeAddress,
        network ?? 'TESTNET',
      );

      if (!isMountedRef.current) return;

      const xlmBalanceObj = allBalances.find(
        (balance: AccountBalance) => balance.asset_type === 'native',
      );

      setState({
        xlmBalance: xlmBalanceObj?.balance ?? '0',
        allBalances,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if (!isMountedRef.current) return;

      let errorMessage = 'Failed to fetch balance';
      if (err instanceof Error) {
        if (err.message.includes('404')) {
          errorMessage = 'Account not found. The account may not be funded yet.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (err.message.toLowerCase().includes('network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = err.message;
        }
      }

      setState((prev: BalanceState) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [activeAddress, network]);

  /** Manually trigger a balance refresh */
  const refresh = useCallback(() => fetchBalance(), [fetchBalance]);

  const clearRefreshInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setupRefreshInterval = useCallback(() => {
    clearRefreshInterval();
    if (refreshInterval > 0 && activeAddress) {
      intervalRef.current = setInterval(() => void fetchBalance(), refreshInterval);
    }
  }, [refreshInterval, activeAddress, fetchBalance, clearRefreshInterval]);

  // Fetch on mount or address change
  useEffect(() => {
    if (fetchOnMount && activeAddress) {
      void fetchBalance();
    }
  }, [activeAddress, fetchOnMount, fetchBalance]);

  // Auto-refresh interval
  useEffect(() => {
    setupRefreshInterval();
    return () => clearRefreshInterval();
  }, [setupRefreshInterval, clearRefreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearRefreshInterval();
    };
  }, [clearRefreshInterval]);

  return {
    /** XLM balance as a string (e.g., "100.5000000") */
    xlmBalance: state.xlmBalance,
    /** All account balances including assets */
    allBalances: state.allBalances,
    /** Whether balance is currently being fetched */
    isLoading: state.isLoading,
    /** Error message if fetch failed */
    error: state.error,
    /** Timestamp of last successful fetch */
    lastUpdated: state.lastUpdated,
    /** Manually trigger a balance refresh */
    refresh,
    /** Whether the hook has an active address to fetch balance for */
    hasAddress: !!activeAddress,
  };
}
