/**
 * WalletProvider — Issue #1462
 *
 * Composes the three focused sub-providers in order:
 *   WalletConnectionProvider  →  WalletBalanceProvider  →  WalletSigningProvider
 *
 * Also re-exports the legacy WalletContext so that existing consumers that
 * read from WalletContext directly (e.g. older tests) keep working unchanged.
 * All new code should use the narrow hooks:
 *   useWalletConnection, useWalletBalance, useWalletSigning
 * or the combined convenience hook useWallet (from hooks/useWallet.ts).
 */
import React, {
  createContext,
  type ReactNode,
} from 'react';
import { WalletConnectionProvider, useWalletConnection } from './WalletConnectionProvider';
import { WalletBalanceProvider, useWalletBalance } from './WalletBalanceProvider';
import { WalletSigningProvider, useWalletSigning } from './WalletSigningProvider';
import type { WalletContextValue } from './types';

// ── Legacy combined context (backward-compat shim) ────────────────────────────

/**
 * WalletContext exposes the full combined WalletContextValue that was
 * previously provided by the monolithic WalletProvider.
 *
 * Consumers can continue importing from here, or switch to the narrower
 * hooks for better tree-shaking and clarity.
 */
export const WalletContext = createContext<WalletContextValue | undefined>(undefined);

/**
 * Internal bridge: reads from all three sub-contexts and surfaces the
 * combined WalletContextValue into the legacy WalletContext.
 */
function WalletContextBridge({ children }: { children: ReactNode }) {
  const connection = useWalletConnection();
  useWalletBalance();
  const signing = useWalletSigning();

  const value: WalletContextValue = {
    // — connection slice —
    wallets: connection.wallets,
    selectedWalletId: connection.selectedWalletId,
    status: connection.status,
    activeAddress: connection.activeAddress,
    network: connection.network,
    connectedAccounts: connection.connectedAccounts,
    error: connection.error,
    refreshWallets: connection.refreshWallets,
    connect: connection.connect,
    disconnect: connection.disconnect,
    switchWallet: connection.switchWallet,
    switchAccount: connection.switchAccount,
    // — signing slice —
    signTransaction: signing.signTransaction,
    signMessage: signing.signMessage,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// ── Composed root provider ────────────────────────────────────────────────────

/**
 * WalletProvider — drop-in replacement for the old monolithic provider.
 *
 * Render this once at the top of your app tree (or in main.tsx / App.tsx).
 * It internally composes:
 *   1. WalletConnectionProvider — connection lifecycle
 *   2. WalletBalanceProvider    — balance polling (depends on 1)
 *   3. WalletSigningProvider    — tx / message signing
 *   4. WalletContextBridge      — exposes legacy WalletContext shim
 */
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <WalletConnectionProvider>
    <WalletBalanceProvider>
      <WalletSigningProvider>
        <WalletContextBridge>
          {children}
        </WalletContextBridge>
      </WalletSigningProvider>
    </WalletBalanceProvider>
  </WalletConnectionProvider>
);

// Re-export sub-providers and hooks for direct use
export { WalletConnectionProvider, useWalletConnection } from './WalletConnectionProvider';
export { WalletBalanceProvider, useWalletBalance } from './WalletBalanceProvider';
export { WalletSigningProvider, useWalletSigning } from './WalletSigningProvider';
