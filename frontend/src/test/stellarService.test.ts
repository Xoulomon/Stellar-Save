/**
 * stellarService.test.ts
 *
 * Unit tests for stellarService — all Horizon.Server calls are mocked so
 * the test suite never touches the real Stellar network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SDK before any imports
vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>(
    '@stellar/stellar-sdk',
  );
  return {
    ...actual,
    Horizon: {
      Server: vi.fn(),
    },
  };
});

import { Horizon } from '@stellar/stellar-sdk';
import { StellarService, stellarService } from '../lib/stellarService';
import type { HorizonPaymentRecord } from '../lib/stellarService';

// ── Mock factories ────────────────────────────────────────────────────────────

const FAKE_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

function makeAccount(balances = [{ asset_type: 'native', balance: '100.5000000' }]) {
  return {
    id: FAKE_ADDRESS,
    balances,
    sequenceNumber: () => '12345',
  };
}

function makePaymentsPage(records: Partial<HorizonPaymentRecord>[] = []) {
  return { records };
}

function makeServerMock() {
  const paymentsCursor = {
    forAccount: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    cursor: vi.fn().mockReturnThis(),
    call: vi.fn().mockResolvedValue(makePaymentsPage()),
  };
  return {
    loadAccount: vi.fn().mockResolvedValue(makeAccount()),
    payments: vi.fn().mockReturnValue(paymentsCursor),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let serverMock: ReturnType<typeof makeServerMock>;

beforeEach(() => {
  serverMock = makeServerMock();
  (Horizon.Server as ReturnType<typeof vi.fn>).mockImplementation(() => serverMock);
});

// ── loadAccount ───────────────────────────────────────────────────────────────

describe('StellarService.loadAccount()', () => {
  it('calls Horizon.Server with the correct URL for TESTNET', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'TESTNET');
    expect(Horizon.Server).toHaveBeenCalledWith(
      'https://horizon-testnet.stellar.org',
    );
  });

  it('calls Horizon.Server with the correct URL for MAINNET', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'MAINNET');
    expect(Horizon.Server).toHaveBeenCalledWith('https://horizon.stellar.org');
  });

  it('calls Horizon.Server with the correct URL for PUBLIC', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'PUBLIC');
    expect(Horizon.Server).toHaveBeenCalledWith('https://horizon.stellar.org');
  });

  it('calls Horizon.Server with the correct URL for FUTURENET', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'FUTURENET');
    expect(Horizon.Server).toHaveBeenCalledWith(
      'https://horizon-futurenet.stellar.org',
    );
  });

  it('defaults to TESTNET URL for unknown network names', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'UNKNOWN_NET');
    expect(Horizon.Server).toHaveBeenCalledWith(
      'https://horizon-testnet.stellar.org',
    );
  });

  it('calls server.loadAccount with the address', async () => {
    await stellarService.loadAccount(FAKE_ADDRESS, 'TESTNET');
    expect(serverMock.loadAccount).toHaveBeenCalledWith(FAKE_ADDRESS);
  });

  it('returns id, balances, and sequence', async () => {
    const result = await stellarService.loadAccount(FAKE_ADDRESS, 'TESTNET');
    expect(result.id).toBe(FAKE_ADDRESS);
    expect(result.balances).toHaveLength(1);
    expect(result.sequence).toBe('12345');
  });

  it('propagates errors from Horizon', async () => {
    serverMock.loadAccount.mockRejectedValueOnce(new Error('Not found'));
    await expect(
      stellarService.loadAccount(FAKE_ADDRESS, 'TESTNET'),
    ).rejects.toThrow('Not found');
  });
});

// ── getXlmBalance ─────────────────────────────────────────────────────────────

describe('StellarService.getXlmBalance()', () => {
  it('returns the native XLM balance', async () => {
    const result = await stellarService.getXlmBalance(FAKE_ADDRESS, 'TESTNET');
    expect(result).toBe('100.5000000');
  });

  it('returns null when no native balance entry exists', async () => {
    serverMock.loadAccount.mockResolvedValueOnce(
      makeAccount([{ asset_type: 'credit_alphanum4', balance: '50', asset_code: 'USDC' }]),
    );
    const result = await stellarService.getXlmBalance(FAKE_ADDRESS, 'TESTNET');
    expect(result).toBeNull();
  });

  it('returns null when balances array is empty', async () => {
    serverMock.loadAccount.mockResolvedValueOnce(makeAccount([]));
    const result = await stellarService.getXlmBalance(FAKE_ADDRESS, 'TESTNET');
    expect(result).toBeNull();
  });
});

// ── getAllBalances ─────────────────────────────────────────────────────────────

describe('StellarService.getAllBalances()', () => {
  it('returns all balance entries', async () => {
    const balances = [
      { asset_type: 'native', balance: '100.0' },
      { asset_type: 'credit_alphanum4', balance: '50.0', asset_code: 'USDC' },
    ];
    serverMock.loadAccount.mockResolvedValueOnce(makeAccount(balances));

    const result = await stellarService.getAllBalances(FAKE_ADDRESS, 'TESTNET');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ asset_type: 'native', balance: '100.0' });
    expect(result[1]).toMatchObject({ asset_code: 'USDC' });
  });

  it('returns empty array when account has no balances', async () => {
    serverMock.loadAccount.mockResolvedValueOnce(makeAccount([]));
    const result = await stellarService.getAllBalances(FAKE_ADDRESS, 'TESTNET');
    expect(result).toHaveLength(0);
  });
});

// ── fetchPayments ─────────────────────────────────────────────────────────────

describe('StellarService.fetchPayments()', () => {
  const paymentRecord: HorizonPaymentRecord = {
    id: 'p1',
    type: 'payment',
    created_at: '2026-01-01T00:00:00Z',
    transaction_hash: 'abc123',
    amount: '100.0',
    asset_type: 'native',
    from: FAKE_ADDRESS,
  };

  it('calls payments().forAccount().order().limit().call()', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    expect(serverMock.payments).toHaveBeenCalled();
  });

  it('passes forAccount with the address', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.forAccount).toHaveBeenCalledWith(FAKE_ADDRESS);
  });

  it('uses default limit 50', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.limit).toHaveBeenCalledWith(50);
  });

  it('uses default order desc', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.order).toHaveBeenCalledWith('desc');
  });

  it('respects custom limit option', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET', { limit: 100 });
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.limit).toHaveBeenCalledWith(100);
  });

  it('respects custom order option', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET', { order: 'asc' });
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.order).toHaveBeenCalledWith('asc');
  });

  it('uses cursor when provided', async () => {
    await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET', { cursor: 'cursor-abc' });
    const paymentsMock = serverMock.payments();
    expect(paymentsMock.cursor).toHaveBeenCalledWith('cursor-abc');
  });

  it('returns the records array', async () => {
    serverMock.payments().call.mockResolvedValueOnce(makePaymentsPage([paymentRecord]));
    const results = await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'p1', amount: '100.0' });
  });

  it('returns empty array when records is undefined', async () => {
    serverMock.payments().call.mockResolvedValueOnce({ records: undefined });
    const results = await stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET');
    expect(results).toHaveLength(0);
  });

  it('propagates errors from Horizon', async () => {
    serverMock.payments().call.mockRejectedValueOnce(new Error('Rate limited'));
    await expect(
      stellarService.fetchPayments(FAKE_ADDRESS, 'TESTNET'),
    ).rejects.toThrow('Rate limited');
  });
});

// ── Singleton ─────────────────────────────────────────────────────────────────

describe('stellarService singleton', () => {
  it('is an instance of StellarService', () => {
    expect(stellarService).toBeInstanceOf(StellarService);
  });
});
