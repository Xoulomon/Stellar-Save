export type HardwareWalletType = 'ledger' | 'trezor';
export type ConnectionMethod = 'ble' | 'usb' | 'webusb';
export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';
export type TxApprovalStatus = 'idle' | 'pending_device' | 'approved' | 'rejected' | 'error';

export interface HardwareDeviceInfo {
  id: string;
  name: string;
  type: HardwareWalletType;
  connection: ConnectionMethod;
  firmwareVersion?: string;
  batteryLevel?: number;
  lastConnected?: number;
}

export interface HardwareAccount {
  index: number;
  path: string;
  publicKey: string;
  address: string;
  label?: string;
}

export interface HardwareWalletState {
  type: HardwareWalletType | null;
  status: ConnectionStatus;
  device: HardwareDeviceInfo | null;
  accounts: HardwareAccount[];
  selectedAccount: HardwareAccount | null;
  error: string | null;
}

export interface TxApprovalRequest {
  id: string;
  title: string;
  xdr: string;
  network: string;
  fee: string;
  operations: { type: string; summary: string }[];
  status: TxApprovalStatus;
  result?: string;
  error?: string;
}

export const HARDWARE_WALLET_I18N: Record<string, string> = {
  ledger: 'Ledger',
  trezor: 'Trezor',
  ble: 'Bluetooth LE',
  usb: 'USB',
  webusb: 'WebUSB',
  disconnected: 'Not connected',
  scanning: 'Searching for devices...',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Connection failed',
  idle: 'Awaiting confirmation',
  pending_device: 'Check your hardware device',
  approved: 'Approved',
  rejected: 'Rejected',
};
