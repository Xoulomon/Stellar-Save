/**
 * Shared Vitest manual mock for @stellar/stellar-sdk (frontend).
 *
 * Placed at frontend/src/__mocks__/@stellar/stellar-sdk.ts so that any
 * frontend test that calls `vi.mock('@stellar/stellar-sdk')` picks this up
 * automatically — no inline factory required.
 *
 * Tests that need the real SDK must use:
 *   const realSdk = await vi.importActual('@stellar/stellar-sdk');
 *
 * Usage
 * -----
 * 1. Auto-mock (simplest):
 *      vi.mock('@stellar/stellar-sdk');
 *    Picks up this file; all exported items are pre-configured stubs.
 *
 * 2. Extend a specific method for a test:
 *      vi.mock('@stellar/stellar-sdk');
 *      const { Horizon } = await import('@stellar/stellar-sdk');
 *      (Horizon.Server as ReturnType<typeof vi.fn>)
 *        .mockImplementationOnce(() => ({ loadAccount: vi.fn().mockResolvedValue({...}) }));
 *
 * 3. Access mock helpers from this file:
 *      import { makeMockHorizonServer, FAKE_ACCOUNT_ID } from
 *        '../__mocks__/@stellar/stellar-sdk';
 */

import { vi } from 'vitest';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Deterministic fake Stellar account ID for assertions. */
export const FAKE_ACCOUNT_ID =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export const FAKE_TX_HASH =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// ─── Helper factories ─────────────────────────────────────────────────────────

/**
 * Returns a fresh mock Horizon.Server instance with all methods as vi.fn().
 * Override per-test with `.mockResolvedValueOnce(...)`.
 */
export function makeMockHorizonServer() {
  return {
    loadAccount: vi.fn().mockResolvedValue({
      id: FAKE_ACCOUNT_ID,
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
      sequence: '0',
    }),
    submitTransaction: vi.fn().mockResolvedValue({
      hash: FAKE_TX_HASH,
      successful: true,
    }),
    transactions: vi.fn().mockReturnValue({
      forAccount: vi.fn().mockReturnThis(),
      call: vi.fn().mockResolvedValue({ records: [] }),
    }),
    payments: vi.fn().mockReturnValue({
      forAccount: vi.fn().mockReturnThis(),
      call: vi.fn().mockResolvedValue({ records: [] }),
    }),
  };
}

/**
 * Returns a fresh mock SorobanRpc.Server instance.
 */
export function makeMockSorobanRpcServer() {
  return {
    getAccount: vi.fn().mockResolvedValue({
      accountId: () => FAKE_ACCOUNT_ID,
      sequenceNumber: () => '0',
      incrementSequenceNumber: vi.fn(),
    }),
    simulateTransaction: vi.fn().mockResolvedValue({
      result: { retval: { switch: () => ({ name: 'scvVoid' }) } },
      minResourceFee: '100',
      footprint: null,
    }),
    sendTransaction: vi.fn().mockResolvedValue({
      status: 'PENDING',
      hash: FAKE_TX_HASH,
      errorResult: null,
    }),
    getTransaction: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      returnValue: null,
      ledger: 1234,
    }),
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1234 }),
  };
}

// ─── Keypair stub ─────────────────────────────────────────────────────────────

const FAKE_PUBLIC_KEY = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZEGZTH9BHHM5FHST22H0';
const FAKE_SECRET_KEY = 'SDNKN3BYAQSNTSMT6JFHXPHK7GCUO63QO5KDUVWBXDXZOFQK7KPCHAH';

class FakeKeypair {
  static random(): FakeKeypair {
    return new FakeKeypair();
  }

  static fromSecret(_secret: string): FakeKeypair {
    return new FakeKeypair();
  }

  static fromPublicKey(_key: string): FakeKeypair {
    return new FakeKeypair();
  }

  publicKey(): string {
    return FAKE_PUBLIC_KEY;
  }

  secret(): string {
    return FAKE_SECRET_KEY;
  }

  sign(_data: Buffer): Buffer {
    return Buffer.alloc(64, 0);
  }

  verify(_data: Buffer, _signature: Buffer): boolean {
    return true;
  }
}

// ─── Networks stub ────────────────────────────────────────────────────────────

export const Networks = {
  PUBLIC: 'Public Global Stellar Network ; September 2015',
  TESTNET: 'Test SDF Network ; September 2015',
  FUTURENET: 'Test SDF Future Network ; October 2022',
  STANDALONE: 'Standalone Network ; February 2017',
};

// ─── Asset stub ───────────────────────────────────────────────────────────────

class FakeAsset {
  constructor(
    public readonly code: string = 'XLM',
    public readonly issuer?: string,
  ) {}

  static native(): FakeAsset {
    return new FakeAsset('XLM');
  }

  isNative(): boolean {
    return this.code === 'XLM' && !this.issuer;
  }

  getCode(): string {
    return this.code;
  }

  getIssuer(): string | undefined {
    return this.issuer;
  }
}

// ─── TransactionBuilder stub ──────────────────────────────────────────────────

class FakeTransactionBuilder {
  constructor(_sourceAccount: unknown, _opts?: unknown) {}

  addOperation(_op: unknown): this {
    return this;
  }

  setTimeout(_seconds: number): this {
    return this;
  }

  build(): Record<string, unknown> {
    return {
      toXDR: () => 'AAAAAAAAAA==',
      toEnvelope: () => ({ toXDR: () => 'AAAAAAAAAA==' }),
    };
  }

  static fromXDR(_xdr: string, _networkPassphrase: string): Record<string, unknown> {
    return {
      toXDR: () => _xdr,
      toEnvelope: () => ({ toXDR: () => _xdr }),
    };
  }
}

// ─── Operation stub ───────────────────────────────────────────────────────────

export const Operation = {
  payment: vi.fn().mockReturnValue({ type: 'payment' }),
  manageData: vi.fn().mockReturnValue({ type: 'manageData' }),
  changeTrust: vi.fn().mockReturnValue({ type: 'changeTrust' }),
  setOptions: vi.fn().mockReturnValue({ type: 'setOptions' }),
  manageSellOffer: vi.fn().mockReturnValue({ type: 'manageSellOffer' }),
  manageBuyOffer: vi.fn().mockReturnValue({ type: 'manageBuyOffer' }),
  createAccount: vi.fn().mockReturnValue({ type: 'createAccount' }),
  mergeAccount: vi.fn().mockReturnValue({ type: 'mergeAccount' }),
};

// ─── Contract stub ────────────────────────────────────────────────────────────

class FakeContract {
  constructor(public readonly contractId: string) {}

  call(_method: string, ..._args: unknown[]): Record<string, unknown> {
    return { type: 'invokeHostFunction' };
  }
}

// ─── Address stub ─────────────────────────────────────────────────────────────

class FakeAddress {
  constructor(public readonly address: string) {}

  toScVal(): Record<string, unknown> {
    return { switch: () => ({ name: 'scvAddress' }) };
  }

  toString(): string {
    return this.address;
  }
}

// ─── SorobanRpc Api helpers (v14 shape) ───────────────────────────────────────

const SorobanRpcApi = {
  isSimulationError: vi.fn((result: unknown) => {
    return (
      !!result &&
      typeof result === 'object' &&
      'error' in (result as object) &&
      (result as Record<string, unknown>)['error'] !== undefined
    );
  }),
  isSimulationSuccess: vi.fn((result: unknown) => {
    return (
      !!result &&
      typeof result === 'object' &&
      !('error' in (result as object))
    );
  }),
  assembleTransaction: vi.fn((_tx: unknown, _sim: unknown) => ({
    build: vi.fn().mockReturnValue({
      toXDR: () => 'ASSEMBLED_TX_XDR==',
    }),
  })),
  GetTransactionStatus: {
    SUCCESS: 'SUCCESS' as const,
    FAILED: 'FAILED' as const,
    NOT_FOUND: 'NOT_FOUND' as const,
  },
};

// ─── Main exports (mirrors @stellar/stellar-sdk v14 frontend shape) ───────────

/** SorobanRpc namespace (v14 shape used by frontend) */
export const SorobanRpc = {
  Server: vi.fn().mockImplementation(() => makeMockSorobanRpcServer()),
  Api: SorobanRpcApi,
  assembleTransaction: SorobanRpcApi.assembleTransaction,
};

/** Horizon namespace */
export const Horizon = {
  Server: vi.fn().mockImplementation(() => makeMockHorizonServer()),
};

export { FakeKeypair as Keypair };
export { FakeAsset as Asset };
export { FakeTransactionBuilder as TransactionBuilder };
export { FakeContract as Contract };
export { FakeAddress as Address };

export const BASE_FEE = '100';
export const nativeToScVal = vi.fn().mockReturnValue({ switch: () => ({ name: 'scvVoid' }) });
export const scValToNative = vi.fn().mockReturnValue(null);
export const xdr = {
  ScVal: {
    scvVoid: vi.fn().mockReturnValue({ switch: () => ({ name: 'scvVoid' }) }),
  },
};
