/**
 * useRamp.ts
 *
 * Hook for SEP-24 fiat ramp operations:
 * - initiate deposit / withdraw
 * - poll transaction status
 * - list recent ramp transactions for the user
 */

import { useCallback, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import type { RampTransaction, RampTransactionType, RampInitResponse } from '../types/ramp';

export interface UseRampResult {
  initiateDeposit: (params: { anchorDomain: string; assetCode: string; assetIssuer?: string; amount?: string; stellarAccount?: string }) => Promise<RampInitResponse>;
  initiateWithdraw: (params: { anchorDomain: string; assetCode: string; assetIssuer?: string; amount?: string; stellarAccount?: string }) => Promise<RampInitResponse>;
  getTransaction: (id: string) => Promise<RampTransaction | null>;
  pollStatus: (id: string, intervalMs?: number) => Promise<RampTransaction | null>;
}

export function useRamp(): UseRampResult {
  const initiate = useCallback(
    async (type: RampTransactionType, params: { anchorDomain: string; assetCode: string; assetIssuer?: string; amount?: string; stellarAccount?: string }): Promise<RampInitResponse> => {
      const path = type === 'deposit' ? '/ramp/deposit' : '/ramp/withdraw';
      return api.post<RampInitResponse>(path, params);
    },
    [],
  );

  const initiateDeposit = useCallback(
    (params: Parameters<typeof initiate>[1]) => initiate('deposit', params),
    [initiate],
  );

  const initiateWithdraw = useCallback(
    (params: Parameters<typeof initiate>[1]) => initiate('withdraw', params),
    [initiate],
  );

  const getTransaction = useCallback(async (id: string): Promise<RampTransaction | null> => {
    setError(null);
    try {
      return await api.get<RampTransaction>(`/ramp/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }, []);

  const pollStatus = useCallback(
    async (id: string, intervalMs = 2000): Promise<RampTransaction | null> => {
      setError(null);
      try {
        return await api.get<RampTransaction>(`/ramp/${encodeURIComponent(id)}/status`);
      } catch {
        return null;
      }
    },
    [],
  );

  return { initiateDeposit, initiateWithdraw, getTransaction, pollStatus };
}

export function useRampTransactionPoller(txId: string | null, enabled = true): RampTransaction | null {
  const [record, setRecord] = useState<RampTransaction | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!txId || !enabled) {
      setRecord(null);
      return;
    }

    const terminal = new Set<string>(['completed', 'refunded', 'expired', 'error']);

    const tick = async () => {
      try {
        const updated = await api.get<RampTransaction>(`/ramp/${encodeURIComponent(txId)}/status`);
        if (!updated) return;
        setRecord(updated);
        if (terminal.has(updated.status) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch {
        // keep polling on transient errors
      }
    };

    void tick();
    intervalRef.current = setInterval(tick, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [txId, enabled]);

  return record;
}
