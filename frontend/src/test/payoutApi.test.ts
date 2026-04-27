/**
 * payoutApi.test.ts
 *
 * Unit tests and property-based tests for frontend/src/utils/payoutApi.ts.
 * All contractClient functions are mocked via vi.mock.
 * Property tests use fast-check with a minimum of 100 iterations each.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ─── Mock contractClient ──────────────────────────────────────────────────────

// Use vi.hoisted so ContractError is available inside the vi.mock factory (which is hoisted)
const { ContractError } = vi.hoisted(() => {
  class ContractError extends Error {
    code: number | null;
    constructor(code: number | null, message: string) {
      super(message);
      this.name = 'ContractError';
      this.code = code;
    }
  }
  return { ContractError };
});

vi.mock('../lib/contractClient', () => {
  return {
    ContractError,
    parseContractError: (err: unknown) => {
      if (err instanceof ContractError) return err;
      if (err instanceof Error) return new ContractError(null, err.message);
      return new ContractError(null, String(err));
    },
    executePayout: vi.fn(),
    getPayoutSchedule: vi.fn(),
    hasReceivedPayout: vi.fn(),
    getMemberCount: vi.fn(),
    getGroupBalance: vi.fn(),
  };
});

import {
  executePayout,
  getPayoutQueue,
  getPayoutHistory,
  getNextRecipient,
} from '../utils/payoutApi';

import * as contractClient from '../lib/contractClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGetPayoutSchedule = contractClient.getPayoutSchedule as ReturnType<typeof vi.fn>;
const mockHasReceivedPayout = contractClient.hasReceivedPayout as ReturnType<typeof vi.fn>;
const mockGetMemberCount = contractClient.getMemberCount as ReturnType<typeof vi.fn>;
const mockGetGroupBalance = contractClient.getGroupBalance as ReturnType<typeof vi.fn>;
const mockExecutePayout = contractClient.executePayout as ReturnType<typeof vi.fn>;

function makeEntry(recipient: string, cycle = 1, payout_date = 1700000000n) {
  return { recipient, cycle, payout_date };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getNextRecipient ─────────────────────────────────────────────────────────

describe('getNextRecipient', () => {
  it('returns null for empty schedule', async () => {
    mockGetPayoutSchedule.mockResolvedValue([]);
    expect(await getNextRecipient('1')).toBeNull();
  });

  it('returns null when all members have been paid', async () => {
    mockGetPayoutSchedule.mockResolvedValue([
      makeEntry('ADDR1'),
      makeEntry('ADDR2'),
    ]);
    mockHasReceivedPayout.mockResolvedValue(true);
    expect(await getNextRecipient('1')).toBeNull();
  });

  it('returns the first unpaid recipient', async () => {
    mockGetPayoutSchedule.mockResolvedValue([
      makeEntry('ADDR1'),
      makeEntry('ADDR2'),
      makeEntry('ADDR3'),
    ]);
    mockHasReceivedPayout
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    expect(await getNextRecipient('1')).toBe('ADDR2');
  });

  it('stops iterating after finding the first unpaid entry', async () => {
    mockGetPayoutSchedule.mockResolvedValue([
      makeEntry('ADDR1'),
      makeEntry('ADDR2'),
    ]);
    mockHasReceivedPayout
      .mockResolvedValueOnce(false);
    await getNextRecipient('1');
    expect(mockHasReceivedPayout).toHaveBeenCalledTimes(1);
  });

  // Property 6: getNextRecipient returns first unpaid recipient
  it('[Property 6] returns the recipient at the lowest unpaid index', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 8 }).chain((len) =>
          fc.tuple(
            fc.array(
              fc.record({ recipient: fc.string({ minLength: 1 }), cycle: fc.integer({ min: 0 }), payout_date: fc.bigInt({ min: 0n, max: 9999999999n }) }),
              { minLength: len, maxLength: len },
            ),
            fc.array(fc.boolean(), { minLength: len, maxLength: len }),
          ),
        ),
        async ([schedule, flags]) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          let callIdx = 0;
          mockHasReceivedPayout.mockImplementation(() => Promise.resolve(flags[callIdx++] ?? false));

          const result = await getNextRecipient('1');
          const firstUnpaidIdx = flags.findIndex((f) => !f);

          if (firstUnpaidIdx === -1 || schedule.length === 0) {
            expect(result).toBeNull();
          } else {
            expect(result).toBe(schedule[firstUnpaidIdx].recipient);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── executePayout ────────────────────────────────────────────────────────────

describe('executePayout', () => {
  it('throws ContractError when callerAddress is empty', async () => {
    await expect(executePayout('1', '')).rejects.toMatchObject({
      message: 'Wallet is not connected.',
    });
  });

  it('throws ContractError when no eligible recipient found', async () => {
    mockGetPayoutSchedule.mockResolvedValue([]);
    await expect(executePayout('1', 'CALLER')).rejects.toMatchObject({
      message: 'No eligible recipient found for payout.',
    });
  });

  it('returns tx hash on success', async () => {
    // getNextRecipient internally calls getPayoutSchedule + hasReceivedPayout
    mockGetPayoutSchedule.mockResolvedValue([makeEntry('ADDR1')]);
    mockHasReceivedPayout.mockResolvedValueOnce(false);
    mockExecutePayout.mockResolvedValue('txhash123');
    expect(await executePayout('1', 'CALLER')).toBe('txhash123');
  });

  it('re-throws ContractError code 4002 unchanged', async () => {
    mockGetPayoutSchedule.mockResolvedValue([makeEntry('ADDR1')]);
    mockHasReceivedPayout.mockResolvedValueOnce(false);
    const err = new ContractError(4002, 'Payout has already been processed for this cycle.');
    mockExecutePayout.mockRejectedValue(err);
    await expect(executePayout('1', 'CALLER')).rejects.toMatchObject({ code: 4002 });
  });

  it('re-throws ContractError code 4003 unchanged', async () => {
    mockGetPayoutSchedule.mockResolvedValue([makeEntry('ADDR1')]);
    mockHasReceivedPayout.mockResolvedValueOnce(false);
    const err = new ContractError(4003, 'Invalid payout recipient.');
    mockExecutePayout.mockRejectedValue(err);
    await expect(executePayout('1', 'CALLER')).rejects.toMatchObject({ code: 4003 });
  });
});

// ─── getPayoutHistory ─────────────────────────────────────────────────────────

describe('getPayoutHistory', () => {
  it('returns [] for empty schedule', async () => {
    mockGetPayoutSchedule.mockResolvedValue([]);
    expect(await getPayoutHistory('1')).toEqual([]);
  });

  it('returns [] when no members have been paid', async () => {
    mockGetPayoutSchedule.mockResolvedValue([makeEntry('ADDR1'), makeEntry('ADDR2')]);
    mockHasReceivedPayout.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    expect(await getPayoutHistory('1')).toEqual([]);
  });

  it('returns only paid entries with status completed', async () => {
    const schedule = [makeEntry('ADDR1', 1, 1700000000n), makeEntry('ADDR2', 2, 1700086400n)];
    const paidMap: Record<string, boolean> = { ADDR1: true, ADDR2: false };
    mockGetPayoutSchedule.mockResolvedValue(schedule);
    mockHasReceivedPayout.mockImplementation((_gid: bigint, addr: string) =>
      Promise.resolve(paidMap[addr] ?? false),
    );
    const result = await getPayoutHistory('1');
    expect(result).toHaveLength(1);
    expect(result[0].memberAddress).toBe('ADDR1');
    expect(result[0].status).toBe('completed');
    expect(result[0].paidAt).toBeInstanceOf(Date);
  });

  // Property 7: getPayoutHistory filters to completed entries only
  it('[Property 7] returns exactly the paid entries with status completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 8 }).chain((len) =>
          fc.tuple(
            fc.array(
              fc.record({ recipient: fc.string({ minLength: 1 }), cycle: fc.integer({ min: 0 }), payout_date: fc.bigInt({ min: 0n, max: 9999999999n }) }),
              { minLength: len, maxLength: len },
            ),
            fc.array(fc.boolean(), { minLength: len, maxLength: len }),
          ),
        ),
        async ([schedule, flags]) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          let callIdx = 0;
          mockHasReceivedPayout.mockImplementation(() => Promise.resolve(flags[callIdx++] ?? false));

          const result = await getPayoutHistory('1');
          const expectedCount = flags.filter(Boolean).length;

          expect(result).toHaveLength(expectedCount);
          result.forEach((entry) => {
            expect(entry.status).toBe('completed');
            expect(entry.paidAt).toBeInstanceOf(Date);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 8: timestamp conversion round-trip
  it('[Property 8] timestamp conversion round-trip', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 9999999999n }),
        (ts) => {
          const date = new Date(Number(ts * 1000n));
          expect(date.getTime()).toBe(Number(ts) * 1000);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── getPayoutQueue ───────────────────────────────────────────────────────────

describe('getPayoutQueue', () => {
  it('returns empty queue for empty schedule', async () => {
    mockGetPayoutSchedule.mockResolvedValue([]);
    mockGetMemberCount.mockResolvedValue(0);
    const result = await getPayoutQueue('1');
    expect(result.entries).toEqual([]);
    expect(result.totalMembers).toBe(0);
  });

  it('assigns completed/next/upcoming statuses correctly', async () => {
    const schedule = [makeEntry('ADDR1'), makeEntry('ADDR2'), makeEntry('ADDR3')];
    const paidMap: Record<string, boolean> = { ADDR1: true, ADDR2: false, ADDR3: false };
    mockGetPayoutSchedule.mockResolvedValue(schedule);
    mockGetMemberCount.mockResolvedValue(3);
    mockGetGroupBalance.mockResolvedValue(30_000_000n);
    mockHasReceivedPayout.mockImplementation((_gid: bigint, addr: string) =>
      Promise.resolve(paidMap[addr] ?? false),
    );

    const result = await getPayoutQueue('1');
    expect(result.entries[0].status).toBe('completed');
    expect(result.entries[1].status).toBe('next');
    expect(result.entries[2].status).toBe('upcoming');
  });

  it('includes currentUserAddress when provided', async () => {
    mockGetPayoutSchedule.mockResolvedValue([makeEntry('ADDR1')]);
    mockGetMemberCount.mockResolvedValue(1);
    mockGetGroupBalance.mockResolvedValue(10_000_000n);
    mockHasReceivedPayout.mockResolvedValue(false);

    const result = await getPayoutQueue('1', 'MYADDR');
    expect(result.currentUserAddress).toBe('MYADDR');
  });

  // Property 4: PayoutStatus assignment correctness
  it('[Property 4] assigns exactly one next, correct completed/upcoming', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (paidFlags) => {
          vi.clearAllMocks();
          const schedule = paidFlags.map((_, i) =>
            makeEntry(`ADDR${i}`, i, BigInt(1700000000 + i * 86400)),
          );
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          mockGetMemberCount.mockResolvedValue(schedule.length);
          mockGetGroupBalance.mockResolvedValue(BigInt(schedule.length) * 10_000_000n);
          // Use address-based lookup since Promise.all resolves in parallel
          const paidByAddr: Record<string, boolean> = {};
          schedule.forEach((e, i) => { paidByAddr[e.recipient] = paidFlags[i]; });
          mockHasReceivedPayout.mockImplementation((_gid: bigint, addr: string) =>
            Promise.resolve(paidByAddr[addr] ?? false),
          );

          const result = await getPayoutQueue('1');
          const statuses = result.entries.map((e) => e.status);
          const nextCount = statuses.filter((s) => s === 'next').length;
          const firstUnpaidIdx = paidFlags.findIndex((f) => !f);

          if (firstUnpaidIdx === -1) {
            expect(nextCount).toBe(0);
            statuses.forEach((s) => expect(s).toBe('completed'));
          } else {
            expect(nextCount).toBe(1);
            expect(statuses[firstUnpaidIdx]).toBe('next');
            paidFlags.forEach((paid, i) => {
              if (paid) expect(statuses[i]).toBe('completed');
              else if (i > firstUnpaidIdx) expect(statuses[i]).toBe('upcoming');
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 5: amount conversion invariant
  it('[Property 5] amount equals groupBalance / totalMembers / 10_000_000', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
        fc.integer({ min: 1, max: 20 }),
        async (balance, memberCount) => {
          vi.clearAllMocks();
          const schedule = Array.from({ length: memberCount }, (_, i) =>
            makeEntry(`ADDR${i}`, i, BigInt(1700000000 + i * 86400)),
          );
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          mockGetMemberCount.mockResolvedValue(memberCount);
          mockGetGroupBalance.mockResolvedValue(balance);
          mockHasReceivedPayout.mockResolvedValue(false);

          const result = await getPayoutQueue('1');
          const expectedAmount = Number(balance) / memberCount / 10_000_000;
          result.entries.forEach((entry) => {
            expect(entry.amount).toBeCloseTo(expectedAmount, 10);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Error handling properties ────────────────────────────────────────────────

describe('error handling', () => {
  // Property 1: ContractError pass-through
  it('[Property 1] ContractError is re-thrown unchanged from getNextRecipient', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ code: fc.option(fc.integer({ min: 1000, max: 9999 })), message: fc.string() }),
        async ({ code, message }) => {
          vi.clearAllMocks();
          const err = new ContractError(code ?? null, message);
          mockGetPayoutSchedule.mockRejectedValue(err);
          await expect(getNextRecipient('1')).rejects.toMatchObject({ code: code ?? null, message });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('[Property 1] ContractError is re-thrown unchanged from getPayoutHistory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ code: fc.option(fc.integer({ min: 1000, max: 9999 })), message: fc.string() }),
        async ({ code, message }) => {
          vi.clearAllMocks();
          const err = new ContractError(code ?? null, message);
          mockGetPayoutSchedule.mockRejectedValue(err);
          await expect(getPayoutHistory('1')).rejects.toMatchObject({ code: code ?? null, message });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('[Property 1] ContractError is re-thrown unchanged from getPayoutQueue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ code: fc.option(fc.integer({ min: 1000, max: 9999 })), message: fc.string() }),
        async ({ code, message }) => {
          vi.clearAllMocks();
          const err = new ContractError(code ?? null, message);
          mockGetPayoutSchedule.mockRejectedValue(err);
          mockGetMemberCount.mockResolvedValue(0);
          await expect(getPayoutQueue('1')).rejects.toMatchObject({ code: code ?? null, message });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 2: Non-ContractError normalisation
  it('[Property 2] non-ContractError is normalised to ContractError', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (msg) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockRejectedValue(new Error(msg));
          const caught = await getNextRecipient('1').catch((e) => e);
          expect(caught).toBeInstanceOf(ContractError);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 3: hasReceivedPayout call count
  it('[Property 3] hasReceivedPayout called N times for getPayoutHistory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ recipient: fc.string({ minLength: 1 }), cycle: fc.integer({ min: 0 }), payout_date: fc.bigInt({ min: 0n, max: 9999999999n }) }), { minLength: 0, maxLength: 10 }),
        async (schedule) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          mockHasReceivedPayout.mockResolvedValue(false);
          await getPayoutHistory('1');
          expect(mockHasReceivedPayout).toHaveBeenCalledTimes(schedule.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('[Property 3] hasReceivedPayout called N times for getPayoutQueue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ recipient: fc.string({ minLength: 1 }), cycle: fc.integer({ min: 0 }), payout_date: fc.bigInt({ min: 0n, max: 9999999999n }) }), { minLength: 0, maxLength: 10 }),
        async (schedule) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          mockGetMemberCount.mockResolvedValue(schedule.length);
          mockGetGroupBalance.mockResolvedValue(0n);
          mockHasReceivedPayout.mockResolvedValue(false);
          await getPayoutQueue('1');
          expect(mockHasReceivedPayout).toHaveBeenCalledTimes(schedule.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('[Property 3] hasReceivedPayout called at most N times for getNextRecipient', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ recipient: fc.string({ minLength: 1 }), cycle: fc.integer({ min: 0 }), payout_date: fc.bigInt({ min: 0n, max: 9999999999n }) }), { minLength: 0, maxLength: 10 }),
        async (schedule) => {
          vi.clearAllMocks();
          mockGetPayoutSchedule.mockResolvedValue(schedule);
          mockHasReceivedPayout.mockResolvedValue(true);
          await getNextRecipient('1');
          expect(mockHasReceivedPayout.mock.calls.length).toBeLessThanOrEqual(schedule.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
