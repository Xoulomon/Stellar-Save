import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { useWallet } from '../hooks/useWallet';
import { WalletConnectionContext } from '../wallet/WalletConnectionProvider';
import { WalletSigningContext } from '../wallet/WalletSigningProvider';

import type { WalletConnectionContextValue } from '../wallet/WalletConnectionProvider';
import type { WalletSigningContextValue } from '../wallet/WalletSigningProvider';

const mockConnection: WalletConnectionContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'idle',
  activeAddress: null,
  network: null,
  connectedAccounts: [],
  error: null,
  refreshWallets: async () => {},
  connect: async () => {},
  disconnect: async () => {},
  switchWallet: async () => {},
  switchAccount: () => {},
};

const mockSigning: WalletSigningContextValue = {
  signTransaction: async () => 'signed-xdr',
  signMessage: async () => 'signed-message',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WalletConnectionContext.Provider value={mockConnection}>
      <WalletSigningContext.Provider value={mockSigning}>{children}</WalletSigningContext.Provider>
    </WalletConnectionContext.Provider>
  );
}

describe('useWallet', () => {
  it('combines the connection and signing contexts', () => {
    const { result } = renderHook(() => useWallet(), { wrapper });
    expect(result.current.status).toBe('idle');
    expect(result.current.activeAddress).toBeNull();
    expect(result.current.signTransaction).toBe(mockSigning.signTransaction);
    expect(result.current.signMessage).toBe(mockSigning.signMessage);
  });

  it('throws when either context provider is missing', () => {
    const connectionOnly = ({ children }: { children: React.ReactNode }) => (
      <WalletConnectionContext.Provider value={mockConnection}>
        {children}
      </WalletConnectionContext.Provider>
    );
    const signingOnly = ({ children }: { children: React.ReactNode }) => (
      <WalletSigningContext.Provider value={mockSigning}>
        {children}
      </WalletSigningContext.Provider>
    );

    expect(() => renderHook(() => useWallet())).toThrow(
      'useWallet must be used within WalletProvider.'
    );
    expect(() => renderHook(() => useWallet(), { wrapper: connectionOnly })).toThrow(
      'useWallet must be used within WalletProvider.'
    );
    expect(() => renderHook(() => useWallet(), { wrapper: signingOnly })).toThrow(
      'useWallet must be used within WalletProvider.'
    );
  });
});
