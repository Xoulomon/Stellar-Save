import { useState, useEffect, useCallback, useRef } from 'react';
import { Horizon } from '@stellar/stellar-sdk';
import { useWallet } from './useWallet';

export interface Balance {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
}

export interface BalanceState {
  xlmBalance: string | null;
  allBalances: Balance[];
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
  
  /**
   * Custom Horizon server URL
   * @default 'https://horizon-testnet.stellar.org' for testnet
   */
  horizonUrl?: string;
}

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_HORIZON_URL = 'https://horizon-testnet.stellar.org';

/**
 * Hook for fetching and managing Stellar account XLM balance
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
    horizonUrl = DEFAULT_HORIZON_URL,
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
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Determine the appropriate Horizon server based on network
   */
  const getHorizonServer = useCallback(() => {
    // If custom URL is provided, use it
    if (horizonUrl !== DEFAULT_HORIZON_URL) {
      return new Horizon.Server(horizonUrl);
    }

    // Otherwise, determine based on network
    if (network === 'PUBLIC' || network === 'MAINNET') {
      return new Horizon.Server('https://horizon.stellar.org');
    }
    
    // Default to testnet
    return new Horizon.Server('https://horizon-testnet.stellar.org');
  }, [horizonUrl, network]);

  /**
   * Fetch balance from Stellar Horizon API
   */
  const fetchBalance = useCallback(async () => {
    // Don't fetch if no active address
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

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setState((prev: BalanceState) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const server = getHorizonServer();
      const account = await server.loadAccount(activeAddress);

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Extract XLM balance (native asset)
      const xlmBalanceObj = account.balances.find(
        (balance: Balance) => balance.asset_type === 'native'
      );

      const xlmBalance = xlmBalanceObj?.balance || '0';

      setState({
        xlmBalance,
        allBalances: account.balances as Balance[],
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      // Only update error state if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      let errorMessage = 'Failed to fetch balance';

      if (err instanceof Error) {
        // Handle specific Horizon errors
        if (err.message.includes('404')) {
          errorMessage = 'Account not found. The account may not be funded yet.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (err.message.includes('Network')) {
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
  }, [activeAddress, getHorizonServer]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    return fetchBalance();
  }, [fetchBalance]);

  /**
   * Clear the auto-refresh interval
   */
  const clearRefreshInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Set up auto-refresh interval
   */
  const setupRefreshInterval = useCallback(() => {
    clearRefreshInterval();

    if (refreshInterval > 0 && activeAddress) {
      intervalRef.current = setInterval(() => {
        void fetchBalance();
      }, refreshInterval);
    }
  }, [refreshInterval, activeAddress, fetchBalance, clearRefreshInterval]);

  // Fetch balance on mount or when address changes
  useEffect(() => {
    if (fetchOnMount && activeAddress) {
      void fetchBalance();
    }
  }, [activeAddress, fetchOnMount, fetchBalance]);

  // Set up auto-refresh
  useEffect(() => {
    setupRefreshInterval();

    return () => {
      clearRefreshInterval();
    };
  }, [setupRefreshInterval, clearRefreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearRefreshInterval();
      
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearRefreshInterval]);

  return {
    /**
     * XLM balance as a string (e.g., "100.5000000")
     */
    xlmBalance: state.xlmBalance,
    
    /**
     * All account balances including assets
     */
    allBalances: state.allBalances,
    
    /**
     * Whether balance is currently being fetched
     */
    isLoading: state.isLoading,
    
    /**
     * Error message if fetch failed
     */
    error: state.error,
    
    /**
     * Timestamp of last successful fetch
     */
    lastUpdated: state.lastUpdated,
    
    /**
     * Manually trigger a balance refresh
     */
    refresh,
    
    /**
     * Whether the hook has an active address to fetch balance for
     */
    hasAddress: !!activeAddress,
  };
}
