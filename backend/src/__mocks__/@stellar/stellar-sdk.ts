/**
 * Shared Jest manual mock for @stellar/stellar-sdk (backend).
 *
 * Placed at backend/src/__mocks__/@stellar/stellar-sdk.ts so that any
 * backend test that calls `jest.mock('@stellar/stellar-sdk')` picks this up
 * automatically — no inline factory required.
 *
 * Tests that need the real SDK for legitimate crypto work (e.g. Keypair.random()
 * in auth.test.ts or sep24-sandbox.ts) must call:
 *
 *   jest.unmock('@stellar/stellar-sdk');
 *
 * before importing the module, or import the real SDK via:
 *
 *   const realSdk = jest.requireActual('@stellar/stellar-sdk');
 *
 * Usage
 * -----
 * 1. Auto-mock (simplest):
 *      jest.mock('@stellar/stellar-sdk');
 *    Picks up this file; all exported items are pre-configured stubs.
 *
 * 2. Extend a specific mock in a test:
 *      jest.mock('@stellar/stellar-sdk');
 *      const { rpc } = require('@stellar/stellar-sdk');
 *      (rpc.Server.prototype.getAccount as jest.Mock).mockResolvedValueOnce({ ... });
 *
 * 3. Access helpers from this module:
 *      import { makeMockServer, FAKE_ACCOUNT } from '../__mocks__/@stellar/stellar-sdk';
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** A deterministic fake Stellar account ID for use in assertions. */
export const FAKE_ACCOUNT_ID =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export const FAKE_TX_HASH =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// ─── Helper factory ───────────────────────────────────────────────────────────

/**
 * Returns a fresh mock rpc.Server instance with all methods pre-configured as
 * Jest mocks. Useful when you need to override responses per-test:
 *
 *   const server = makeMockRpcServer();
 *   server.getAccount.mockResolvedValueOnce({ accountId: () => '...', ... });
 */
export function makeMockRpcServer() {
  return {
    getAccount: jest.fn().mockResolvedValue({
      accountId: () => FAKE_ACCOUNT_ID,
      sequenceNumber: () => '0',
      incrementSequenceNumber: jest.fn(),
    }),
    simulateTransaction: jest.fn().mockResolvedValue({
      error: undefined,
      result: {
        retval: { switch: () => ({ name: 'scvVoid' }) },
      },
      minResourceFee: '100',
      footprint: null,
    }),
    sendTransaction: jest.fn().mockResolvedValue({
      status: 'PENDING',
      hash: FAKE_TX_HASH,
      errorResult: null,
    }),
    getTransaction: jest.fn().mockResolvedValue({
      status: 'SUCCESS',
      returnValue: null,
      ledger: 1234,
    }),
    getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1234 }),
    getEvents: jest.fn().mockResolvedValue({ events: [] }),
  };
}

/**
 * Returns a fresh mock Horizon.Server instance.
 */
export function makeMockHorizonServer() {
  return {
    loadAccount: jest.fn().mockResolvedValue({
      id: FAKE_ACCOUNT_ID,
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
      sequence: '0',
    }),
    submitTransaction: jest.fn().mockResolvedValue({
      hash: FAKE_TX_HASH,
      successful: true,
    }),
    transactions: jest.fn().mockReturnValue({
      forAccount: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    }),
    payments: jest.fn().mockReturnValue({
      forAccount: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    }),
  };
}

// ─── FakeServer (rpc.Server drop-in) ─────────────────────────────────────────

/**
 * Lightweight class-based stub for rpc.Server.
 * Suitable for pool tests that only need the constructor signature.
 */
class FakeRpcServer {
  constructor(public readonly url: string, _opts?: unknown) {}
}

// ─── Keypair stub ─────────────────────────────────────────────────────────────

/**
 * Stub Keypair with deterministic fake values.
 * Tests that need real signing behaviour must use jest.requireActual.
 */
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

const Networks = {
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

const Operation = {
  payment: jest.fn().mockReturnValue({ type: 'payment' }),
  manageData: jest.fn().mockReturnValue({ type: 'manageData' }),
  changeTrust: jest.fn().mockReturnValue({ type: 'changeTrust' }),
  setOptions: jest.fn().mockReturnValue({ type: 'setOptions' }),
  manageSellOffer: jest.fn().mockReturnValue({ type: 'manageSellOffer' }),
  manageBuyOffer: jest.fn().mockReturnValue({ type: 'manageBuyOffer' }),
  createAccount: jest.fn().mockReturnValue({ type: 'createAccount' }),
  mergeAccount: jest.fn().mockReturnValue({ type: 'mergeAccount' }),
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

// ─── SorobanRpc Api helpers ───────────────────────────────────────────────────

const SorobanRpcApi = {
  isSimulationError: jest.fn((result: unknown) => {
    return (
      !!result &&
      typeof result === 'object' &&
      'error' in (result as object) &&
      (result as Record<string, unknown>)['error'] !== undefined
    );
  }),
  isSimulationSuccess: jest.fn((result: unknown) => {
    return (
      !!result &&
      typeof result === 'object' &&
      !('error' in (result as object))
    );
  }),
  assembleTransaction: jest.fn((_tx: unknown, _sim: unknown) => ({
    build: jest.fn().mockReturnValue({
      toXDR: () => 'ASSEMBLED_TX_XDR==',
    }),
  })),
  GetTransactionStatus: {
    SUCCESS: 'SUCCESS' as const,
    FAILED: 'FAILED' as const,
    NOT_FOUND: 'NOT_FOUND' as const,
  },
};

// ─── Main exports (mirrors @stellar/stellar-sdk v15 structure) ────────────────

/** rpc namespace (previously SorobanRpc) */
export const rpc = {
  Server: jest.fn().mockImplementation((url: string, opts?: unknown) => {
    return new FakeRpcServer(url, opts);
  }),
  Api: SorobanRpcApi,
  assembleTransaction: SorobanRpcApi.assembleTransaction,
};

/** SorobanRpc namespace alias (v14 compat / frontend) */
export const SorobanRpc = {
  Server: jest.fn().mockImplementation((url: string, opts?: unknown) => {
    return new FakeRpcServer(url, opts);
  }),
  Api: SorobanRpcApi,
  assembleTransaction: SorobanRpcApi.assembleTransaction,
};

/** Horizon namespace */
export const Horizon = {
  Server: jest.fn().mockImplementation(() => makeMockHorizonServer()),
};

export { FakeKeypair as Keypair };
export { Networks };
export { FakeAsset as Asset };
export { FakeTransactionBuilder as TransactionBuilder };
export { Operation };
export { FakeContract as Contract };
export { FakeAddress as Address };

export const BASE_FEE = '100';
export const nativeToScVal = jest.fn().mockReturnValue({ switch: () => ({ name: 'scvVoid' }) });
export const scValToNative = jest.fn().mockReturnValue(null);
export const xdr = {
  ScVal: {
    scvVoid: jest.fn().mockReturnValue({ switch: () => ({ name: 'scvVoid' }) }),
  },
  Operation: jest.fn(),
};

// ─── Named re-export of the real Keypair for tests that need it ───────────────
// Usage: const { Keypair: RealKeypair } = jest.requireActual('@stellar/stellar-sdk');
