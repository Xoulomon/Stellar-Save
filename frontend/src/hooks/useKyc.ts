/**
 * useKyc.ts
 *
 * Hook to fetch and watch KYC status from the backend.
 * Requires backend authentication.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useBackendAuth } from './useBackendAuth';
import type { KycStatusResult } from '../types/ramp';

export function useKycStatus(): {
  status: KycStatusResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { isAuthenticated, authenticate } = useBackendAuth();
  const [status, setStatus] = useState<KycStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      try {
        await authenticate();
      } catch {
        setError('Authentication required to check KYC status');
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<KycStatusResult>('/kyc/status');
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KYC status');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authenticate]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  return { status, isLoading, error, refresh: fetchStatus };
}
