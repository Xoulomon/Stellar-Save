/**
 * useTransaction.ts
 *
 * React hook for handling Stellar/Soroban transaction submission and tracking.
 * Manages the full lifecycle of a single in-flight transaction.
 *
 * Exposes: { state, txHash, error, execute, reset }
 * States: 'idle' | 'pending' | 'confirmed' | 'failed'
 *
 * Note: This hook is unrelated to useTransactions — useTransactions fetches
 * transaction history (a list), while this hook manages a single tx lifecycle.
 */

import { useState, useCallback } from 'react';
import { env } from '../lib/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionState = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface ExecuteOptions {
  /**
   * If set, execute() fails with a timeout error when fn() has not
   * resolved within this many milliseconds.
   */
  timeoutMs?: number;
}

export interface UseTransactionReturn {
  state: TransactionState;
  txHash: string | null;
  error: string | null;
  execute: (fn: () => Promise<string>, options?: ExecuteOptions) => Promise<void>;
  reset: () => void;
}

// ─── Network config (for explorer links) ─────────────────────────────────────

export const STELLAR_NETWORK: string = env.VITE_STELLAR_NETWORK;

export function explorerUrl(txHash: string): string {
  const net = STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Transaction timed out')), ms);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransaction(): UseTransactionReturn {
  const [state, setState] = useState<TransactionState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setTxHash(null);
    setError(null);
  }, []);

  /**
   * execute wraps an async function that returns a tx hash.
   * Sets state to 'pending' while running, 'confirmed' on success,
   * 'failed' on error (including when it times out per options.timeoutMs).
   */
  const execute = useCallback(async (fn: () => Promise<string>, options?: ExecuteOptions) => {
    setState('pending');
    setTxHash(null);
    setError(null);
    try {
      const hash = options?.timeoutMs
        ? await Promise.race([fn(), timeoutAfter(options.timeoutMs)])
        : await fn();
      setTxHash(hash);
      setState('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setState('failed');
    }
  }, []);

  return { state, txHash, error, execute, reset };
}
