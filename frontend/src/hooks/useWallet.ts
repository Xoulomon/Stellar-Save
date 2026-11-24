import { useContext } from 'react';

import { WalletConnectionContext } from '../wallet/WalletConnectionProvider';
import { WalletSigningContext } from '../wallet/WalletSigningProvider';

import type { WalletContextValue } from '../wallet/types';

export function useWallet(): WalletContextValue {
  const connection = useContext(WalletConnectionContext);
  const signing = useContext(WalletSigningContext);
  if (!connection || !signing) {
    throw new Error('useWallet must be used within WalletProvider.');
  }

  return { ...connection, ...signing };
}
