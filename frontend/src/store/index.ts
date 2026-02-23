import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { createSavingsSlice, type SavingsSlice } from './slices/savingsSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createWalletSlice, type WalletSlice } from './slices/walletSlice';

export type StoreState = WalletSlice & SavingsSlice & UiSlice;

export const useStore = create<StoreState>()(
  devtools(
    persist(
      (set) => ({
        ...createWalletSlice<StoreState>(set),
        ...createSavingsSlice<StoreState>(set),
        ...createUiSlice<StoreState>(set),
      }),
      {
        name: 'stellar-save-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          wallet: state.wallet,
          groups: state.groups,
          activeGroupId: state.activeGroupId,
        }),
      },
    ),
    { name: 'stellar-save-store' },
  ),
);

export const useWallet = () => useStore((state) => state.wallet);
export const useGroups = () => useStore((state) => state.groups);
export const useNotifications = () => useStore((state) => state.notifications);