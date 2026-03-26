export type WalletConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export interface WalletConnection {
  address: string;
  network: string;
}

export interface WalletAdapter {
  id: string;
  name: string;
  isInstalled: () => Promise<boolean>;
  connect: () => Promise<WalletConnection>;
  getAddress: () => Promise<string>;
  getNetwork: () => Promise<string>;
  watch: (onChange: () => void) => () => void;
}

export interface WalletContextValue {
  wallets: WalletDescriptor[];
  selectedWalletId: string;
  status: WalletConnectionStatus;
  activeAddress: string | null;
  network: string | null;
  connectedAccounts: string[];
  error: string | null;
  refreshWallets: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchWallet: (walletId: string) => Promise<void>;
  switchAccount: (address: string) => void;
}

export interface WalletDescriptor {
  id: string;
  name: string;
  installed: boolean;
}
