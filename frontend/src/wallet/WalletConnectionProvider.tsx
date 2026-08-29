/**
 * WalletConnectionProvider — Issue #1462
 *
 * Responsible for wallet connection lifecycle only:
 * - Connecting / disconnecting
 * - Switching wallets and accounts
 * - Persisting session to localStorage
 * - Exposing connection status, active address, and network
 */
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useContext,
} from 'react';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import type { WalletConnectionStatus, WalletDescriptor } from './types';

// ── Kit singleton ─────────────────────────────────────────────────────────────

StellarWalletsKit.init({
  modules: [new FreighterModule(), new AlbedoModule(), new LobstrModule()],
  selectedWalletId: FREIGHTER_ID,
  network: Networks.TESTNET,
});

// ── Context shape ─────────────────────────────────────────────────────────────

export interface WalletConnectionContextValue {
  /** List of available / installed wallets */
  wallets: WalletDescriptor[];
  /** The currently selected wallet identifier */
  selectedWalletId: string;
  /** Overall connection status */
  status: WalletConnectionStatus;
  /** Connected account public key, or null when disconnected */
  activeAddress: string | null;
  /** Stellar network passphrase of the connected account */
  network: string | null;
  /** All addresses available under the connected wallet session */
  connectedAccounts: string[];
  /** Human-readable error message when status === 'error' */
  error: string | null;
  /** Re-probe which wallet extensions are currently installed */
  refreshWallets: () => Promise<void>;
  /** Initiate a wallet connection using the currently selected wallet */
  connect: () => Promise<void>;
  /** Disconnect the active wallet session */
  disconnect: () => Promise<void>;
  /** Switch to a different wallet extension */
  switchWallet: (walletId: string) => Promise<void>;
  /** Manually override the active address (e.g. sub-account) */
  switchAccount: (address: string) => void;
}

export const WalletConnectionContext = createContext<
  WalletConnectionContextValue | undefined
>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const WalletConnectionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<WalletConnectionStatus>('idle');
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(FREIGHTER_ID);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletDescriptor[]>([
    { id: FREIGHTER_ID, name: 'Freighter', installed: false },
    { id: 'albedo', name: 'Albedo', installed: false },
    { id: 'lobstr', name: 'Lobstr', installed: false },
  ]);

  const refreshWallets = useCallback(async () => {
    const supported = await StellarWalletsKit.refreshSupportedWallets();
    setWallets(
      supported.map((w) => ({ id: w.id, name: w.name, installed: w.isAvailable })),
    );
  }, []);

  // Restore persisted session on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('swk_address');
    const savedWallet = localStorage.getItem('swk_wallet');
    if (savedAddress && savedWallet) {
      StellarWalletsKit.setWallet(savedWallet);
      setSelectedWalletId(savedWallet);
      setActiveAddress(savedAddress);
      setStatus('connected');
    }
    void refreshWallets();
  }, [refreshWallets]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      StellarWalletsKit.setWallet(selectedWalletId);
      const { address } = await StellarWalletsKit.getAddress();
      const { networkPassphrase } = await StellarWalletsKit.getNetwork();
      setActiveAddress(address);
      setNetwork(networkPassphrase);
      setStatus('connected');
      localStorage.setItem('swk_address', address);
      localStorage.setItem('swk_wallet', selectedWalletId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('error');
    }
  }, [selectedWalletId]);

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect();
    setActiveAddress(null);
    setNetwork(null);
    setStatus('idle');
    setError(null);
    localStorage.removeItem('swk_address');
    localStorage.removeItem('swk_wallet');
  }, []);

  const switchWallet = useCallback(async (walletId: string) => {
    StellarWalletsKit.setWallet(walletId);
    setSelectedWalletId(walletId);
    setStatus('connecting');
    setError(null);
    try {
      const { address } = await StellarWalletsKit.getAddress();
      const { networkPassphrase } = await StellarWalletsKit.getNetwork();
      setActiveAddress(address);
      setNetwork(networkPassphrase);
      setStatus('connected');
      localStorage.setItem('swk_address', address);
      localStorage.setItem('swk_wallet', walletId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('error');
    }
  }, []);

  const switchAccount = useCallback((address: string) => {
    setActiveAddress(address);
    localStorage.setItem('swk_address', address);
  }, []);

  const value: WalletConnectionContextValue = {
    wallets,
    selectedWalletId,
    status,
    activeAddress,
    network,
    connectedAccounts: activeAddress ? [activeAddress] : [],
    error,
    refreshWallets,
    connect,
    disconnect,
    switchWallet,
    switchAccount,
  };

  return (
    <WalletConnectionContext.Provider value={value}>
      {children}
    </WalletConnectionContext.Provider>
  );
};

// ── Narrow hook ───────────────────────────────────────────────────────────────

export function useWalletConnection(): WalletConnectionContextValue {
  const ctx = useContext(WalletConnectionContext);
  if (!ctx) {
    throw new Error(
      'useWalletConnection must be used within WalletConnectionProvider.',
    );
  }
  return ctx;
}
