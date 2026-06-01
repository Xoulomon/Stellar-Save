/**
 * useTransaction.ts
 *
 * React hook for handling Stellar/Soroban transaction submission and tracking.
 *
 * Exposes: { state, txHash, error, execute }
 * States: 'idle' | 'pending' | 'confirmed' | 'failed'
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionState = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface UseTransactionReturn {
  state: TransactionState;
  txHash: string | null;
  error: string | null;
  execute: (fn: () => Promise<string>) => Promise<void>;
  reset: () => void;
}

// ─── Network config (for explorer links) ─────────────────────────────────────

export const STELLAR_NETWORK: string =
  (import.meta.env['VITE_STELLAR_NETWORK'] as string | undefined) ?? 'testnet';

export function explorerUrl(txHash: string): string {
  const net = STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
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
   * 'failed' on error.
   */
  const execute = useCallback(async (fn: () => Promise<string>) => {
    setState('pending');
    setTxHash(null);
    setError(null);
    try {
      const hash = await fn();
      setTxHash(hash);
      setState('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setState('failed');
    }
  }, []);

  return { state, txHash, error, execute, reset };
}