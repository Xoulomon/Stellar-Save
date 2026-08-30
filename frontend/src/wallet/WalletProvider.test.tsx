import { FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useContext } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { WalletProvider, WalletContext } from './WalletProvider';


import type { WalletContextValue } from './types';


// Mock StellarWalletsKit
vi.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    setWallet: vi.fn(),
    getAddress: vi.fn(),
    getNetwork: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    refreshSupportedWallets: vi.fn(),
  },
  Networks: {
    TESTNET: 'test',
    PUBLIC: 'public',
  },
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/freighter', () => ({
  FreighterModule: vi.fn(() => ({})),
  FREIGHTER_ID: 'freighter',
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/albedo', () => ({
  AlbedoModule: vi.fn(() => ({})),
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/lobstr', () => ({
  LobstrModule: vi.fn(() => ({})),
}));

const TestComponent = () => {
  const context = useContext(WalletContext);
  if (!context) {
    return <div>No context</div>;
  }

  return (
    <div>
      <div data-testid="status">{context.status}</div>
      <div data-testid="address">{context.activeAddress || 'no-address'}</div>
      <div data-testid="network">{context.network || 'no-network'}</div>
      <div data-testid="wallet-id">{context.selectedWalletId}</div>
      <div data-testid="error">{context.error || 'no-error'}</div>
      <button onClick={() => void context.connect()}>Connect</button>
      <button onClick={() => void context.disconnect()}>Disconnect</button>
      <button onClick={() => void context.refreshWallets()}>Refresh</button>
      <div data-testid="wallet-count">{context.wallets.length}</div>
    </div>
  );
};

describe('WalletProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render children with context', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    expect(screen.getByTestId('status')).toBeInTheDocument();
  });

  it('should initialize with idle status', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });

  it('should restore saved address from localStorage on mount', async () => {
    localStorage.setItem('swk_address', 'GTEST123');
    localStorage.setItem('swk_wallet', FREIGHTER_ID);

    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });
    expect(screen.getByTestId('address')).toHaveTextContent('GTEST123');
  });

  it('should list available wallets', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
      { id: 'albedo', name: 'Albedo', isAvailable: false },
      { id: 'lobstr', name: 'Lobstr', isAvailable: true },
    ]);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-count')).toHaveTextContent('3');
    });
  });

  it('should handle connect action', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockResolvedValue({ address: 'GCONNECTED' });
    (StellarWalletsKit.getNetwork as any).mockResolvedValue({
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByText('Connect');
    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });
    expect(screen.getByTestId('address')).toHaveTextContent('GCONNECTED');
  });

  it('should handle disconnect action', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockResolvedValue({ address: 'GTEST' });
    (StellarWalletsKit.getNetwork as any).mockResolvedValue({ networkPassphrase: 'test' });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // First connect
    const connectButton = screen.getByText('Connect');
    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    // Then disconnect
    const disconnectButton = screen.getByText('Disconnect');
    await act(async () => {
      await userEvent.click(disconnectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('idle');
    });
    expect(screen.getByTestId('address')).toHaveTextContent('no-address');
  });

  it('should clear localStorage on disconnect', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockResolvedValue({ address: 'GTEST' });
    (StellarWalletsKit.getNetwork as any).mockResolvedValue({ networkPassphrase: 'test' });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // Connect first
    await act(async () => {
      await userEvent.click(screen.getByText('Connect'));
    });

    await waitFor(() => {
      expect(localStorage.getItem('swk_address')).toBe('GTEST');
    });

    // Disconnect
    await act(async () => {
      await userEvent.click(screen.getByText('Disconnect'));
    });

    expect(localStorage.getItem('swk_address')).toBeNull();
    expect(localStorage.getItem('swk_wallet')).toBeNull();
  });

  it('should handle connect error', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockRejectedValue(new Error('Connection failed'));

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByText('Connect');
    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('error');
    });
    expect(screen.getByTestId('error')).not.toHaveTextContent('no-error');
  });

  it('should update network on successful connect', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockResolvedValue({ address: 'GTEST' });
    (StellarWalletsKit.getNetwork as any).mockResolvedValue({
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByText('Connect'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('network')).not.toHaveTextContent('no-network');
    });
  });

  it('should maintain selected wallet ID', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
      { id: 'albedo', name: 'Albedo', isAvailable: true },
    ]);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    expect(screen.getByTestId('wallet-id')).toHaveTextContent(FREIGHTER_ID);
  });

  it('should provide sign transaction method', async () => {
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    (StellarWalletsKit.refreshSupportedWallets as any).mockResolvedValue([
      { id: FREIGHTER_ID, name: 'Freighter', isAvailable: true },
    ]);
    (StellarWalletsKit.getAddress as any).mockResolvedValue({ address: 'GTEST' });
    (StellarWalletsKit.getNetwork as any).mockResolvedValue({ networkPassphrase: 'test' });
    (StellarWalletsKit.signTransaction as any).mockResolvedValue({
      signedTxXdr: 'signed-xdr-data',
    });

    const SignTxComponent = () => {
      const context = useContext(WalletContext);
      return (
        <button
          onClick={async () => {
            const result = await context?.signTransaction('xdr-data');
            expect(result).toBe('signed-xdr-data');
          }}
        >
          Sign
        </button>
      );
    };

    render(
      <WalletProvider>
        <SignTxComponent />
      </WalletProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByText('Sign'));
    });
  });
});
