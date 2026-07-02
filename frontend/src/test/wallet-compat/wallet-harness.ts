/**
 * Wallet-abstraction test harness — issue #1115
 *
 * Provides factory functions that return mock implementations of the
 * StellarWalletsKit interface for each supported wallet (Freighter, Albedo,
 * Lobstr, and a minimal in-app wallet stub).
 *
 * Each mock follows the same shape as the real kit so the same test cases
 * can be run against every wallet by iterating walletHarnesses().
 */
import { vi } from 'vitest';

// === Types

export type WalletId = 'freighter' | 'albedo' | 'lobstr' | 'in-app';

export interface MockWalletKit {
  id: WalletId;
  name: string;
  /** Resolves with the mock address on success, rejects on user rejection. */
  getAddress: ReturnType<typeof vi.fn>;
  /** Resolves with the network passphrase. */
  getNetwork: ReturnType<typeof vi.fn>;
  /** Signs an XDR string; rejects when the wallet rejects the request. */
  signTransaction: ReturnType<typeof vi.fn>;
  /** Simulates the user explicitly disconnecting. */
  disconnect: ReturnType<typeof vi.fn>;
  /** Switches the active wallet module. */
  setWallet: ReturnType<typeof vi.fn>;
  /** Returns the supported wallet list with installed flags. */
  refreshSupportedWallets: ReturnType<typeof vi.fn>;
}

export interface WalletHarnessOptions {
  /** Override the default mock address. */
  address?: string;
  /** Simulate the wallet not being installed (isInstalled = false). */
  notInstalled?: boolean;
  /** Simulate the user rejecting the connect/sign prompt. */
  userRejects?: boolean;
  /** Simulate a generic error on getAddress. */
  connectionError?: string;
}

// === Default values

const DEFAULT_ADDRESS = 'GABCDE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012345678';
const DEFAULT_NETWORK = 'Test SDF Network ; September 2015';
const DEFAULT_SIGNED_XDR = 'AAAAAQAAA...signed-xdr-stub...';

// === Harness factory

function makeKit(
  id: WalletId,
  name: string,
  opts: WalletHarnessOptions = {},
): MockWalletKit {
  const address = opts.address ?? DEFAULT_ADDRESS;

  const getAddress = opts.userRejects
    ? vi.fn().mockRejectedValue(new Error('User rejected the request.'))
    : opts.notInstalled
    ? vi.fn().mockRejectedValue(new Error(`${name} is not installed.`))
    : opts.connectionError
    ? vi.fn().mockRejectedValue(new Error(opts.connectionError))
    : vi.fn().mockResolvedValue({ address });

  const getNetwork = vi.fn().mockResolvedValue({ networkPassphrase: DEFAULT_NETWORK });

  const signTransaction = opts.userRejects
    ? vi.fn().mockRejectedValue(new Error('User rejected the transaction.'))
    : vi.fn().mockResolvedValue({ signedTxXdr: DEFAULT_SIGNED_XDR });

  const disconnect = vi.fn().mockResolvedValue(undefined);
  const setWallet = vi.fn();

  const refreshSupportedWallets = vi.fn().mockResolvedValue([
    { id, name, isAvailable: !opts.notInstalled },
  ]);

  return { id, name, getAddress, getNetwork, signTransaction, disconnect, setWallet, refreshSupportedWallets };
}

// === Per-wallet factories

export function freighterHarness(opts?: WalletHarnessOptions): MockWalletKit {
  return makeKit('freighter', 'Freighter', opts);
}

export function albedoHarness(opts?: WalletHarnessOptions): MockWalletKit {
  return makeKit('albedo', 'Albedo', opts);
}

export function lobstrHarness(opts?: WalletHarnessOptions): MockWalletKit {
  return makeKit('lobstr', 'Lobstr', opts);
}

export function inAppHarness(opts?: WalletHarnessOptions): MockWalletKit {
  return makeKit('in-app', 'In-App Wallet', opts);
}

/** Returns one default harness per supported wallet — use to iterate tests. */
export function walletHarnesses(opts?: WalletHarnessOptions): MockWalletKit[] {
  return [
    freighterHarness(opts),
    albedoHarness(opts),
    lobstrHarness(opts),
    inAppHarness(opts),
  ];
}

/** Returns one harness per wallet configured to reject every prompt. */
export function rejectingHarnesses(): MockWalletKit[] {
  return walletHarnesses({ userRejects: true });
}

/** Returns one harness per wallet configured as not installed. */
export function notInstalledHarnesses(): MockWalletKit[] {
  return walletHarnesses({ notInstalled: true });
}
