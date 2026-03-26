import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { freighterAdapter } from "./freighterAdapter";
import type {
  WalletAdapter,
  WalletConnectionStatus,
  WalletContextValue,
  WalletDescriptor,
} from "./types";

const adapters: WalletAdapter[] = [freighterAdapter];

export const WalletContext = createContext<WalletContextValue | undefined>(
  undefined,
);

function mergeAddress(addresses: string[], nextAddress: string): string[] {
  if (addresses.includes(nextAddress)) {
    return addresses;
  }
  return [...addresses, nextAddress];
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletDescriptor[]>(
    adapters.map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      installed: false,
    })),
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    adapters[0]?.id ?? "",
  );
  const [status, setStatus] = useState<WalletConnectionStatus>("idle");
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const selectedAdapter = useMemo(
    () => adapters.find((adapter) => adapter.id === selectedWalletId) ?? null,
    [selectedWalletId],
  );

  const clearWatcher = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  const refreshWallets = useCallback(async () => {
    const availability = await Promise.all(
      adapters.map(async (adapter) => ({
        id: adapter.id,
        installed: await adapter.isInstalled(),
      })),
    );

    setWallets((current) =>
      current.map((wallet) => {
        const next = availability.find((entry) => entry.id === wallet.id);
        return next ? { ...wallet, installed: next.installed } : wallet;
      }),
    );
  }, []);

  const refreshConnection = useCallback(async () => {
    if (!selectedAdapter) {
      return;
    }

    try {
      const [address, connectedNetwork] = await Promise.all([
        selectedAdapter.getAddress(),
        selectedAdapter.getNetwork(),
      ]);

      setActiveAddress(address);
      setNetwork(connectedNetwork);
      setConnectedAccounts((previous) => mergeAddress(previous, address));
      setStatus("connected");
      setError(null);
    } catch (connectionError) {
      setStatus("idle");
      setActiveAddress(null);
      setNetwork(null);
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Failed to refresh wallet state.",
      );
    }
  }, [selectedAdapter]);

  const connect = useCallback(async () => {
    if (!selectedAdapter) {
      setError("No wallet adapter selected.");
      return;
    }

    setStatus("connecting");
    setError(null);
    clearWatcher();

    try {
      const connection = await selectedAdapter.connect();
      setStatus("connected");
      setActiveAddress(connection.address);
      setNetwork(connection.network);
      setConnectedAccounts((previous) =>
        mergeAddress(previous, connection.address),
      );
      unsubscribeRef.current = selectedAdapter.watch(() => {
        void refreshConnection();
      });
    } catch (connectionError) {
      setStatus("error");
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Wallet connection failed.",
      );
    }
  }, [clearWatcher, refreshConnection, selectedAdapter]);

  const disconnect = useCallback(() => {
    clearWatcher();
    setStatus("idle");
    setActiveAddress(null);
    setNetwork(null);
    setError(null);
  }, [clearWatcher]);

  const switchWallet = useCallback(
    async (walletId: string) => {
      setSelectedWalletId(walletId);
      setStatus("idle");
      setActiveAddress(null);
      setNetwork(null);
      setError(null);
      clearWatcher();
      await refreshWallets();
    },
    [clearWatcher, refreshWallets],
  );

  const switchAccount = useCallback((address: string) => {
    setActiveAddress(address);
  }, []);

  useEffect(() => {
    void refreshWallets();
  }, [refreshWallets]);

  useEffect(
    () => () => {
      clearWatcher();
    },
    [clearWatcher],
  );

  const value: WalletContextValue = {
    wallets,
    selectedWalletId,
    status,
    activeAddress,
    network,
    connectedAccounts,
    error,
    refreshWallets,
    connect,
    disconnect,
    switchWallet,
    switchAccount,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
