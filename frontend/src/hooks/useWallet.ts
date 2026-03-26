import { useContext } from "react";
import { WalletContext } from "../wallet/WalletProvider";
import type { WalletContextValue } from "../wallet/types";

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider.");
  }
  return context;
}
