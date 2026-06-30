import type {
  HardwareWalletType,
  HardwareDeviceInfo,
  HardwareAccount,
  HardwareWalletState,
  TxApprovalRequest,
  TxApprovalStatus,
  ConnectionMethod,
} from './types';

const STORAGE_KEY = 'stellar-save:hardware-wallet';

const MOCK_DEVICES: Record<string, HardwareDeviceInfo[]> = {
  ledger: [
    { id: 'ledger-001', name: 'Ledger Nano S Plus', type: 'ledger', connection: 'ble', firmwareVersion: '2.2.0', batteryLevel: 85 },
    { id: 'ledger-002', name: 'Ledger Nano X', type: 'ledger', connection: 'ble', firmwareVersion: '2.3.1', batteryLevel: 72 },
  ],
  trezor: [
    { id: 'trezor-001', name: 'Trezor Model T', type: 'trezor', connection: 'usb', firmwareVersion: '24.01.0' },
    { id: 'trezor-002', name: 'Trezor Safe 3', type: 'trezor', connection: 'ble', firmwareVersion: '24.04.0', batteryLevel: 90 },
  ],
};

const MOCK_ACCOUNTS: HardwareAccount[] = [
  { index: 0, path: "m/44'/148'/0'", publicKey: 'GBD4I7Q6C3...', address: 'GBD4I7Q6C3KJDHFJ2D4J3H8K9A1B2C3D4E5F6G7H8', label: 'Account 1' },
  { index: 1, path: "m/44'/148'/1'", publicKey: 'GA6J2K7D8F...', address: 'GA6J2K7D8F9L0P1Q2R3S4T5U6V7W8X9Y0Z1A2B3C', label: 'Account 2' },
  { index: 2, path: "m/44'/148'/2'", publicKey: 'GC3M9N1B5V...', address: 'GC3M9N1B5V7C8X9Z0A1B2C3D4E5F6G7H8I9J0K1L', label: 'Account 3' },
];

function loadPersistedState(): Partial<HardwareWalletState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistState(state: Partial<HardwareWalletState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('Failed to persist hardware wallet state');
  }
}

export function getPersistedWalletType(): HardwareWalletType | null {
  return loadPersistedState().type || null;
}

// ── Device Discovery ──────────────────────────────────────────────────────

export async function scanForDevices(type: HardwareWalletType): Promise<HardwareDeviceInfo[]> {
  await new Promise(r => setTimeout(r, 2000));
  return MOCK_DEVICES[type] || [];
}

export async function connectToDevice(device: HardwareDeviceInfo): Promise<boolean> {
  await new Promise(r => setTimeout(r, 3000));
  if (Math.random() > 0.15) return true;
  throw new Error(`Failed to connect to ${device.name}. Make sure Bluetooth is enabled and the device is unlocked.`);
}

export async function disconnectDevice(): Promise<void> {
  await new Promise(r => setTimeout(r, 500));
  persistState({ type: null, accounts: [], selectedAccount: null });
}

// ── Account Management ────────────────────────────────────────────────────

export async function fetchAccounts(device: HardwareDeviceInfo): Promise<HardwareAccount[]> {
  await new Promise(r => setTimeout(r, 2500));
  return MOCK_ACCOUNTS.map((acc, i) => ({
    ...acc,
    address: acc.address.replace(/\d/, String(i + 1)),
    publicKey: acc.publicKey.replace(/\d/, String(i + 1)),
  }));
}

// ── Transaction Signing ───────────────────────────────────────────────────

export async function signWithHardwareWallet(
  request: TxApprovalRequest,
  device: HardwareDeviceInfo,
  onStatusChange?: (status: TxApprovalStatus) => void,
): Promise<string> {
  onStatusChange?.('pending_device');

  await new Promise(r => setTimeout(r, 4000));

  const success = Math.random() > 0.1;
  if (success) {
    onStatusChange?.('approved');
    return `mock-sig-${Date.now()}-${request.id}`;
  }

  onStatusChange?.('rejected');
  throw new Error('Transaction was rejected on the device. Please review and try again.');
}

export function buildApprovalRequest(
  title: string,
  xdr: string,
  network: string,
  fee: string,
  operations: { type: string; summary: string }[],
): TxApprovalRequest {
  return {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    xdr,
    network,
    fee,
    operations,
    status: 'idle',
  };
}

// ── State Management ──────────────────────────────────────────────────────

export function createInitialState(type?: HardwareWalletType): HardwareWalletState {
  const persisted = loadPersistedState();
  return {
    type: type || persisted.type || null,
    status: 'disconnected',
    device: null,
    accounts: persisted.accounts || [],
    selectedAccount: persisted.selectedAccount || null,
    error: null,
  };
}

export function updatePersistedState(updates: Partial<HardwareWalletState>): void {
  const current = loadPersistedState();
  persistState({ ...current, ...updates });
}
