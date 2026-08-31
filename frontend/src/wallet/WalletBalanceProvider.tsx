/**
 * WalletBalanceProvider — Issue #1462
 *
 * Responsible for balance polling only:
 * - Fetches XLM and all asset balances via stellarService (not the SDK directly)
 * - Auto-refreshes on a configurable interval
 * - Exposes balance state and manual refresh
 *
 * Depends on WalletConnectionProvider being present in the tree.
 */
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useContext,
} from 'react';

import { stellarService } from '../lib/stellarService';
import type { AccountBalance } from '../lib/stellarService';
import { useWalletConnection } from './WalletConnectionProvider';

// Re-export for downstream consumers that imported from this module
export type { AccountBalance as Balance };

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_REFRESH_INTERVAL = 30_000; // ms

// ── Context shape ─────────────────────────────────────────────────────────────

export interface WalletBalanceContextValue {
  /** XLM balance as a string (e.g. "100.5000000"), null when not loaded */
  xlmBalance: string | null;
  /** All account balances including non-XLM assets */
  allBalances: AccountBalance[];
  /** Whether a balance fetch is in flight */
  isLoadingBalance: boolean;
  /** Error message from the most recent balance fetch, if any */
  balanceError: string | null;
  /** Timestamp of the last successful fetch */
  balanceLastUpdated: Date | null;
  /** Manually trigger a balance refresh */
  refreshBalance: () => Promise<void>;
}

export const WalletBalanceContext = createContext<
  WalletBalanceContextValue | undefined
>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

interface WalletBalanceProviderProps {
  children: ReactNode;
  /** Auto-refresh interval in ms. Set to 0 to disable. */
  refreshInterval?: number;
}

export const WalletBalanceProvider: React.FC<WalletBalanceProviderProps> = ({
  children,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
}) => {
  const { activeAddress, network } = useWalletConnection();

  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [allBalances, setAllBalances] = useState<AccountBalance[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLastUpdated, setBalanceLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!activeAddress) {
      setXlmBalance(null);
      setAllBalances([]);
      setBalanceError(null);
      setBalanceLastUpdated(null);
      return;
    }

    setIsLoadingBalance(true);
    setBalanceError(null);

    try {
      const balances = await stellarService.getAllBalances(
        activeAddress,
        network ?? 'TESTNET',
      );

      if (!isMountedRef.current) return;

      const xlmObj = balances.find((b) => b.asset_type === 'native');
      setXlmBalance(xlmObj?.balance ?? '0');
      setAllBalances(balances);
      setBalanceLastUpdated(new Date());
    } catch (err) {
      if (!isMountedRef.current) return;
      let msg = 'Failed to fetch balance';
      if (err instanceof Error) {
        if (err.message.includes('404')) {
          msg = 'Account not found. It may not be funded yet.';
        } else if (
          err.message.includes('timeout') ||
          err.message.toLowerCase().includes('network')
        ) {
          msg = 'Network error. Please check your connection.';
        } else {
          msg = err.message;
        }
      }
      setBalanceError(msg);
    } finally {
      if (isMountedRef.current) setIsLoadingBalance(false);
    }
  }, [activeAddress, network]);

  // Fetch on address change
  useEffect(() => {
    if (activeAddress) void fetchBalance();
  }, [activeAddress, fetchBalance]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (refreshInterval > 0 && activeAddress) {
      intervalRef.current = setInterval(() => void fetchBalance(), refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, activeAddress, fetchBalance]);

  const value: WalletBalanceContextValue = {
    xlmBalance,
    allBalances,
    isLoadingBalance,
    balanceError,
    balanceLastUpdated,
    refreshBalance: fetchBalance,
  };

  return (
    <WalletBalanceContext.Provider value={value}>
      {children}
    </WalletBalanceContext.Provider>
  );
};

// ── Narrow hook ───────────────────────────────────────────────────────────────

export function useWalletBalance(): WalletBalanceContextValue {
  const ctx = useContext(WalletBalanceContext);
  if (!ctx) {
    throw new Error(
      'useWalletBalance must be used within WalletBalanceProvider.',
    );
  }
  return ctx;
}
