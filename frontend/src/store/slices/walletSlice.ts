export type StellarNetwork = 'testnet' | 'mainnet';

export interface WalletState {
  address: string | null;
  network: StellarNetwork;
  isConnected: boolean;
}

export interface WalletSlice {
  wallet: WalletState;
  connectWallet: (address: string) => void;
  disconnectWallet: () => void;
  setNetwork: (network: StellarNetwork) => void;
}

type SliceSetter<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

export const createWalletSlice = <T extends WalletSlice>(set: SliceSetter<T>): WalletSlice => ({
  wallet: {
    address: null,
    network: 'testnet',
    isConnected: false,
  },
  connectWallet: (address) =>
    set((state) => ({
      wallet: {
        ...state.wallet,
        address,
        isConnected: true,
      },
    })),
  disconnectWallet: () =>
    set((state) => ({
      wallet: {
        ...state.wallet,
        address: null,
        isConnected: false,
      },
    })),
  setNetwork: (network) =>
    set((state) => ({
      wallet: {
        ...state.wallet,
        network,
      },
    })),
});