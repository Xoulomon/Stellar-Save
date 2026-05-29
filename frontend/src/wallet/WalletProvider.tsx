import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import type { WalletContextValue, WalletDescriptor, WalletConnectionStatus } from './types';

StellarWalletsKit.init({
  modules: [new FreighterModule(), new AlbedoModule(), new LobstrModule()],
  selectedWalletId: FREIGHTER_ID,
  network: Networks.TESTNET,
});

export const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
    setWallets(supported.map((w) => ({ id: w.id, name: w.name, installed: w.isAvailable })));
  }, []);

  useEffect(() => {
    const savedAddress = localStorage.getItem('swk_address');
    const savedWallet = localStorage.getItem('swk_wallet');
    if (savedAddress && savedWallet) {
      StellarWalletsKit.setWallet(savedWallet);
      setSelectedWalletId(savedWallet);
      setActiveAddress(savedAddress);
      setStatus('connected');
    }
    refreshWallets();
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

  const signTransaction = useCallback(
    async (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, opts);
      return signedTxXdr;
    },
    [],
  );

  const value: WalletContextValue = {
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
    signTransaction,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
