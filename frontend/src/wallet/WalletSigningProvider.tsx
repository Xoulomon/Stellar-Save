/**
 * WalletSigningProvider — Issue #1462
 *
 * Responsible for transaction/message signing only:
 * - signTransaction(xdr, opts)
 * - signMessage(message, opts)
 *
 * Depends on WalletConnectionProvider being present in the tree.
 */
import React, {
  createContext,
  useCallback,
  ReactNode,
  useContext,
} from 'react';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

// ── Context shape ─────────────────────────────────────────────────────────────

export interface WalletSigningContextValue {
  /**
   * Sign a Stellar transaction XDR string.
   * Returns the signed XDR.
   */
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<string>;

  /**
   * Sign an arbitrary UTF-8 message.
   * Returns the base64-encoded signature or the signed message string,
   * depending on wallet support.
   *
   * @throws Error if the current wallet does not support message signing.
   */
  signMessage: (
    message: string,
    opts?: { address?: string },
  ) => Promise<string>;
}

export const WalletSigningContext = createContext<
  WalletSigningContextValue | undefined
>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const WalletSigningProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const signTransaction = useCallback(
    async (
      xdr: string,
      opts?: { networkPassphrase?: string; address?: string },
    ): Promise<string> => {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, opts);
      return signedTxXdr;
    },
    [],
  );

  const signMessage = useCallback(
    async (message: string, opts?: { address?: string }): Promise<string> => {
      const kit = StellarWalletsKit as unknown as Record<string, unknown>;
      if (typeof kit.signMessage === 'function') {
        const result = await (
          kit.signMessage as (
            msg: string,
            o?: { address?: string },
          ) => Promise<{ signedMessage?: string; signature?: string }>
        )(message, opts);
        return result.signedMessage ?? result.signature ?? '';
      }
      throw new Error('Message signing is not supported by the current wallet.');
    },
    [],
  );

  const value: WalletSigningContextValue = { signTransaction, signMessage };

  return (
    <WalletSigningContext.Provider value={value}>
      {children}
    </WalletSigningContext.Provider>
  );
};

// ── Narrow hook ───────────────────────────────────────────────────────────────

export function useWalletSigning(): WalletSigningContextValue {
  const ctx = useContext(WalletSigningContext);
  if (!ctx) {
    throw new Error(
      'useWalletSigning must be used within WalletSigningProvider.',
    );
  }
  return ctx;
}
