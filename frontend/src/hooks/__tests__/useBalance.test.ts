import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useBalance } from '../useBalance';

// Use the shared mock — no live Horizon calls in unit tests.
// See frontend/src/__mocks__/@stellar/stellar-sdk.ts for the full stub surface.
vi.mock('@stellar/stellar-sdk');

// This spy is wired into the shared Horizon.Server mock in beforeEach so that
// individual tests can configure return values without touching the full mock factory.
const loadAccount = vi.fn();

vi.mock('../useWallet', () => ({
  useWallet: () => ({ activeAddress: 'GABC...TESTADDRESS', network: 'TESTNET' }),
}));

describe('useBalance regression: single polling path', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    loadAccount.mockReset();
    loadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
    });
    // Wire the shared Horizon.Server mock to use our local loadAccount spy,
    // so tests can assert on call counts and configure return values.
    const { Horizon } = await import('@stellar/stellar-sdk');
    (Horizon.Server as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      loadAccount: (...args: unknown[]) => loadAccount(...args),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires exactly one fetch per refreshInterval tick, with no extra legacy fallback calls', async () => {
    const refreshInterval = 1000;
    renderHook(() => useBalance({ refreshInterval, fetchOnMount: false }));

    // Advance through 3 ticks of the refresh interval.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(refreshInterval);
      });
    }

    // A legacy/duplicate polling path would fire additional calls on its own
    // cadence (e.g. refreshInterval * 2); exactly 3 calls confirms only the
    // single documented interval is active.
    expect(loadAccount).toHaveBeenCalledTimes(3);
  });

  it('does not poll at all when refreshInterval is 0', async () => {
    renderHook(() => useBalance({ refreshInterval: 0, fetchOnMount: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(loadAccount).not.toHaveBeenCalled();
  });
});
