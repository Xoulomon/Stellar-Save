/**
 * useBackendAuth.ts
 *
 * Bridge between the Stellar wallet and the backend REST API.
 * Handles challenge/verify flow to obtain a JWT token.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from './useWallet';
import { api, setToken } from '../utils/api';

export interface BackendAuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  jwt: string | null;
  authenticate: () => Promise<void>;
  clear: () => void;
}

export function useBackendAuth(): BackendAuthState {
  const { activeAddress, signMessage } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jwtRef = useRef<string | null>(typeof window !== 'undefined' ? localStorage.getItem('stellar_save_jwt') : null);

  const authenticate = useCallback(async () => {
    const address = activeAddress;
    if (!address) {
      setError('Connect your wallet first.');
      return;
    }
    setIsAuthenticating(true);
    setError(null);
    try {
      const { challenge } = await api.get<{ challenge: string }>(`/auth/challenge?walletAddress=${encodeURIComponent(address)}`);
      const signature = await signMessage(challenge, { address });
      const { token } = await api.post<{ token: string }>('/auth/verify', {
        walletAddress: address,
        challenge,
        signature,
      });
      setToken(token);
      jwtRef.current = token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [activeAddress, signMessage]);

  const clear = useCallback(() => {
    setToken(null);
    jwtRef.current = null;
  }, []);

  useEffect(() => {
    if (activeAddress) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('stellar_save_jwt') : null;
      jwtRef.current = saved;
    }
  }, [activeAddress]);

  return {
    isAuthenticated: Boolean(jwtRef.current),
    isAuthenticating,
    error,
    jwt: jwtRef.current,
    authenticate,
    clear,
  };
}
