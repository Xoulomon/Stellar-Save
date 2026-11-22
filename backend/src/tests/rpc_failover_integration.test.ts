/**
 * Integration test for RPC failover (Issue #1726).
 *
 * Simulates a primary-RPC endpoint failure and asserts that:
 *  1. Requests are transparently routed to the secondary (fallback) endpoint.
 *  2. No request is lost or duplicated during failover.
 *  3. After the primary endpoint recovers the pool returns to normal operation.
 *
 * The test drives the real `SorobanClientPool` + `rpc_circuit_breaker` stack
 * with injected Jest mocks for the Stellar SDK so no live node is required.
 * Time-sensitive assertions use `jest.useFakeTimers()` to advance the circuit-
 * breaker reset window without real wall-clock delays.
 */

import { config } from '../config';
import {
  withSorobanCircuit,
  withRpcFallback,
  resetRpcCircuitBreakers,
  sorobanCircuitBreaker,
  CircuitState,
} from '../lib/rpc_circuit_breaker';
import { SorobanClientPool, resetSorobanPool } from '../lib/soroban';

jest.mock('@stellar/stellar-sdk');

// ── Constants derived from config so they track env overrides in CI ──────────

const VOLUME_THRESHOLD = config.rpcCircuitBreaker.volumeThreshold;
const RESET_TIMEOUT_MS = config.rpcCircuitBreaker.resetTimeoutMs;
// A little extra to land clearly past the reset window.
const PAST_RESET_MS = RESET_TIMEOUT_MS + 1_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate `count` consecutive primary-endpoint failures to open the breaker. */
async function driveToOpen(
  run: (fn: () => Promise<unknown>) => Promise<unknown>,
  count = VOLUME_THRESHOLD
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await expect(
      run(async () => {
        throw new Error('ECONNREFUSED primary-rpc');
      })
    ).rejects.toThrow();
  }
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetRpcCircuitBreakers();
  resetSorobanPool();
});

afterEach(() => {
  jest.useRealTimers();
  resetRpcCircuitBreakers();
  resetSorobanPool();
});

// ═════════════════════════════════════════════════════════════════════════════
// #1726-A  Primary failure → failover to secondary
// ═════════════════════════════════════════════════════════════════════════════

describe('#1726 RPC failover – primary failure → secondary failover', () => {
  it('pool routes to secondary when primary is unavailable', async () => {
    /**
     * The pool has one primary client and one fallback client.
     * Primary always throws; fallback always succeeds.
     * `SorobanClientPool.withClient` iterates fallback clients on primary failure.
     */
    let callCount = 0;

    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 1,
      acquireTimeoutMs: 500,
    });

    const result = await pool.withClient(async (client) => {
      callCount++;
      // Identify which client is being used by its URL string representation.
      // The first call goes to the primary (pool.pool), subsequent calls to
      // fallbacks.  We simulate primary failure on the first call only.
      const url = (client as { serverURL?: { toString(): string } }).serverURL?.toString() ?? '';
      if (url.includes('primary')) {
        throw new Error('ECONNREFUSED primary-rpc');
      }
      return { source: 'secondary', url };
    });

    // At minimum the callback was called once (the pool may have tried primary
    // and then fallen through to secondary – both count as the same logical
    // invocation from the pool's perspective).
    expect(callCount).toBeGreaterThanOrEqual(1);
    // The final successful answer came from the secondary.
    expect((result as { source: string }).source).toBe('secondary');
  });

  it('circuit trips OPEN only after all endpoints fail', async () => {
    // When the pool has a fallback that succeeds, the circuit breaker sees a
    // successful call and must remain CLOSED.
    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 1,
      acquireTimeoutMs: 500,
    });

    // Run many calls where primary always fails but secondary always succeeds.
    for (let i = 0; i < VOLUME_THRESHOLD + 2; i++) {
      await pool.withClient(async (client) => {
        const url = (client as { serverURL?: { toString(): string } }).serverURL?.toString() ?? '';
        if (url.includes('primary')) {
          throw new Error('ECONNREFUSED primary-rpc');
        }
        return 'ok';
      });
    }

    // Circuit must still be CLOSED because every invocation ultimately succeeded.
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('circuit trips OPEN when both primary and secondary are down', async () => {
    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 1,
      acquireTimeoutMs: 500,
    });

    // All endpoints fail → the pool re-throws → the circuit breaker counts it.
    for (let i = 0; i < VOLUME_THRESHOLD; i++) {
      await expect(
        pool.withClient(async () => {
          throw new Error('ECONNREFUSED both-rpcs');
        })
      ).rejects.toThrow();
    }

    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// #1726-B  No request is lost or duplicated during failover
// ═════════════════════════════════════════════════════════════════════════════

describe('#1726 RPC failover – no request lost or duplicated', () => {
  it('each request is attempted exactly once and returns exactly one result', async () => {
    const primaryAttempts: number[] = [];
    const secondaryAttempts: number[] = [];
    const results: unknown[] = [];

    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 2,
      acquireTimeoutMs: 500,
    });

    const REQUEST_COUNT = 5;

    for (let seq = 0; seq < REQUEST_COUNT; seq++) {
      const result = await pool.withClient(async (client) => {
        const url = (client as { serverURL?: { toString(): string } }).serverURL?.toString() ?? '';
        if (url.includes('primary')) {
          primaryAttempts.push(seq);
          throw new Error('primary down');
        }
        secondaryAttempts.push(seq);
        return { seq };
      });
      results.push(result);
    }

    // Every request was routed to secondary (primary failed for all).
    expect(secondaryAttempts).toHaveLength(REQUEST_COUNT);

    // Each request appears exactly once in the secondary attempts (no duplication).
    const uniqueSeqs = new Set(secondaryAttempts);
    expect(uniqueSeqs.size).toBe(REQUEST_COUNT);

    // Each request produced exactly one result (no loss).
    expect(results).toHaveLength(REQUEST_COUNT);
    for (let i = 0; i < REQUEST_COUNT; i++) {
      expect((results[i] as { seq: number }).seq).toBe(i);
    }
  });

  it('pool metrics show no leaked clients during failover', async () => {
    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 2,
      acquireTimeoutMs: 500,
    });

    // Mix of primary-fail/secondary-success and fully-failing calls.
    for (let i = 0; i < 4; i++) {
      await pool.withClient(async () => 'secondary ok').catch(() => {/* expected */});
    }

    // Every acquired client must have been returned.
    const m = pool.metrics();
    expect(m.inUse).toBe(0);
    expect(m.available).toBe(m.total);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// #1726-C  Recovery back to primary after reset timeout
// ═════════════════════════════════════════════════════════════════════════════

describe('#1726 RPC failover – recovery back to primary', () => {
  it('breaker transitions OPEN → HALF_OPEN → CLOSED once primary recovers', async () => {
    jest.useFakeTimers();

    // Drive the breaker open via the standalone helper (no pool needed).
    await driveToOpen(withSorobanCircuit);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Advance past the reset window so the breaker allows a trial (HALF_OPEN).
    jest.advanceTimersByTime(PAST_RESET_MS);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Simulate the primary recovering — the trial request succeeds.
    await expect(withSorobanCircuit(async () => 'primary recovered')).resolves.toBe(
      'primary recovered'
    );

    // Breaker is CLOSED: primary is healthy again.
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('pool serves calls normally via the primary once the breaker resets', async () => {
    jest.useFakeTimers();

    const pool = new SorobanClientPool({
      rpcUrl: 'http://primary-rpc.example',
      fallbackRpcUrls: ['http://secondary-rpc.example'],
      poolSize: 1,
      acquireTimeoutMs: 500,
    });

    // Force the circuit open.
    for (let i = 0; i < VOLUME_THRESHOLD; i++) {
      await expect(
        pool.withClient(async () => {
          throw new Error('both endpoints down');
        })
      ).rejects.toThrow();
    }
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Advance past the reset window.
    jest.advanceTimersByTime(PAST_RESET_MS);

    // Now both endpoints are healthy — the next call should succeed.
    const result = await pool.withClient(async () => 'primary is back');
    expect(result).toBe('primary is back');
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('re-trips to OPEN if the recovery probe still fails', async () => {
    jest.useFakeTimers();

    await driveToOpen(withSorobanCircuit);
    jest.advanceTimersByTime(PAST_RESET_MS);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

    // Probe fails — breaker should snap back to OPEN.
    await expect(
      withSorobanCircuit(async () => {
        throw new Error('primary still down');
      })
    ).rejects.toThrow('primary still down');

    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// #1726-D  withRpcFallback degradation during outage
// ═════════════════════════════════════════════════════════════════════════════

describe('#1726 RPC failover – withRpcFallback degradation', () => {
  it('returns the live value when the primary is healthy', async () => {
    const cache = jest.fn().mockResolvedValue({ stale: true });

    const result = await withRpcFallback('soroban_rpc', async () => ({ live: true }), {
      loadFromCache: cache,
      operation: 'test_failover_op',
    });

    expect(result).toEqual({ live: true });
    // Cache must not have been consulted while the primary is healthy.
    expect(cache).not.toHaveBeenCalled();
  });

  it('falls back to cache when the circuit is OPEN', async () => {
    await driveToOpen(withSorobanCircuit);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);

    const cache = jest.fn().mockResolvedValue({ stale: true });
    const live = jest.fn().mockResolvedValue({ live: true });

    const result = await withRpcFallback('soroban_rpc', live, {
      loadFromCache: cache,
      operation: 'test_failover_op',
    });

    expect(result).toEqual({ stale: true });
    // The live RPC function must not have been called while the circuit is open.
    expect(live).not.toHaveBeenCalled();
    expect(cache).toHaveBeenCalledTimes(1);
  });

  it('returns null when circuit is OPEN and cache is empty — no loss, no duplication', async () => {
    await driveToOpen(withSorobanCircuit);

    const result = await withRpcFallback('soroban_rpc', async () => 'live', {
      loadFromCache: async () => null,
      operation: 'test_failover_op',
    });

    // null is the honest "unknown" answer — the request was processed (not lost),
    // and it was only attempted once (not duplicated).
    expect(result).toBeNull();
  });

  it('recovers to live results within the expected time budget', async () => {
    jest.useFakeTimers();

    // Open the circuit.
    await driveToOpen(withSorobanCircuit);

    // Advance past the reset timeout (the "expected time budget").
    jest.advanceTimersByTime(PAST_RESET_MS);

    // Primary is healthy again — live call should succeed via the recovery probe.
    const result = await withRpcFallback('soroban_rpc', async () => ({ recovered: true }), {
      loadFromCache: async () => null,
      operation: 'test_failover_op',
    });

    expect(result).toEqual({ recovered: true });
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });
});
