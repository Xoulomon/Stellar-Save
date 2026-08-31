import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { useWallet } from '../hooks/useWallet';
import { WalletContext } from '../wallet/WalletProvider';

import type { WalletContextValue } from '../wallet/types';

const mockContextValue: WalletContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'idle',
  activeAddress: null,
  network: null,
  connectedAccounts: [],
  error: null,
  refreshWallets: async () => {},
  connect: async () => {},
  disconnect: () => {},
  switchWallet: async () => {},
  switchAccount: () => {},
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <WalletContext.Provider value={mockContextValue}>{children}</WalletContext.Provider>;
}

describe('useWallet', () => {
  it('returns context value when inside WalletProvider', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.status).toBe('idle');
    expect(result.current.activeAddress).toBeNull();
  });

  it('throws when used outside WalletProvider', () => {
    expect(() => {
      renderHook(() => useWallet());
    }).toThrow('useWallet must be used within WalletProvider.');
  });
});
