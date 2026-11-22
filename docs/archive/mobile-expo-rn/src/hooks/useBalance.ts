/**
 * useBalance.ts
 *
 * Fetches XLM balance for the active wallet address via Horizon.
 * Mirrors the frontend useBalance pattern with auto-refresh support.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getXlmBalance } from '../services/contractService';
import { loadSecretKey } from '../wallet/secureStore';
import { Keypair } from '@stellar/stellar-sdk';

const DEFAULT_REFRESH_MS = 30_000;

export interface UseBalanceReturn {
  xlmBalance: string | null;
  publicKey: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBalance(refreshInterval = DEFAULT_REFRESH_MS): UseBalanceReturn {
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchBalance = useCallback(async () => {
    let pk: string;
    try {
      const secret = await loadSecretKey();
      if (!secret) {
        if (mountedRef.current) {
          setXlmBalance(null);
          setPublicKey(null);
        }
        return;
      }
      pk = Keypair.fromSecret(secret).publicKey();
    } catch {
      return;
    }

    if (mountedRef.current) setIsLoading(true);

    try {
      const balance = await getXlmBalance(pk);
      if (mountedRef.current) {
        setXlmBalance(balance);
        setPublicKey(pk);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    void fetchBalance();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => void fetchBalance(), refreshInterval);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalance, refreshInterval]);

  return { xlmBalance, publicKey, isLoading, error, refresh };
}
