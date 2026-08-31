/**
 * Outage-simulation tests for the Soroban / Horizon circuit breakers (#1511).
 *
 * Each block drives a real breaker instance through a simulated RPC outage and
 * asserts the two properties that matter operationally: the backend stops
 * calling a dead endpoint, and it recovers on its own once the endpoint returns.
 */

import {
  sorobanCircuitBreaker,
  horizonCircuitBreaker,
  withSorobanCircuit,
  withHorizonCircuit,
  withRpcFallback,
  isCircuitOpenError,
  resetRpcCircuitBreakers,
  CircuitBreakerOpenError,
  CircuitState,
} from '../lib/rpc_circuit_breaker';
import { SorobanClientPool } from '../lib/soroban';
import { config } from '../config';

jest.mock('@stellar/stellar-sdk');

// Read from config rather than hardcoding: the shared breakers are tuned by
// RPC_BREAKER_* env vars, and a hardcoded count would silently stop simulating
// a full outage if those are overridden in CI.
const VOLUME_THRESHOLD = config.rpcCircuitBreaker.volumeThreshold;
const PAST_RESET_MS = config.rpcCircuitBreaker.resetTimeoutMs + 1_000;

async function simulateOutage(
  run: (fn: () => Promise<unknown>) => Promise<unknown>,
  calls = VOLUME_THRESHOLD
): Promise<jest.Mock> {
  const rpc = jest.fn().mockRejectedValue(new Error('ECONNREFUSED soroban-rpc'));
  for (let i = 0; i < calls; i++) {
    await expect(run(rpc)).rejects.toThrow();
  }
  return rpc;
}

beforeEach(() => {
  resetRpcCircuitBreakers();
});

afterEach(() => {
  jest.useRealTimers();
  resetRpcCircuitBreakers();
});

// === Soroban RPC breaker

describe('Soroban RPC circuit breaker under simulated outage', () => {
  it('passes calls through while the endpoint is healthy', async () => {
    const rpc = jest.fn().mockResolvedValue({ ledger: 42 });

    await expect(withSorobanCircuit(rpc)).resolves.toEqual({ ledger: 42 });
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('trips OPEN once the RPC endpoint fails past the volume threshold', async () => {
    await simulateOutage(withSorobanCircuit);

    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);
  });

  it('fails fast without touching the endpoint while OPEN', async () => {
    await simulateOutage(withSorobanCircuit);

    const rpc = jest.fn().mockRejectedValue(new Error('ECONNREFUSED soroban-rpc'));
    await expect(withSorobanCircuit(rpc)).rejects.toThrow(CircuitBreakerOpenError);

    // The whole point of breaking the circuit: no call reaches the dead endpoint.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recovers to CLOSED after resetTimeout once the endpoint is healthy again', async () => {
    jest.useFakeTimers();
    await simulateOutage(withSorobanCircuit);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Advance past resetTimeout so the breaker allows a trial request.
    jest.advanceTimersByTime(PAST_RESET_MS);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

    await expect(withSorobanCircuit(async () => 'recovered')).resolves.toBe('recovered');
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('re-trips if the trial request during HALF_OPEN still fails', async () => {
    jest.useFakeTimers();
    await simulateOutage(withSorobanCircuit);

    jest.advanceTimersByTime(PAST_RESET_MS);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

    await expect(withSorobanCircuit(async () => { throw new Error('still down'); }))
      .rejects.toThrow('still down');
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});

// === Horizon breaker

describe('Horizon circuit breaker under simulated outage', () => {
  it('trips independently of the Soroban breaker', async () => {
    await simulateOutage(withHorizonCircuit);

    expect(horizonCircuitBreaker.getState()).toBe(CircuitState.OPEN);
    // A Horizon outage must not stop contract reads from being attempted.
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('fails fast with a recognisable circuit error while OPEN', async () => {
    await simulateOutage(withHorizonCircuit);

    const err = await withHorizonCircuit(async () => 'unused').catch((e) => e);
    expect(isCircuitOpenError(err)).toBe(true);
  });
});

// === Pool integration

describe('SorobanClientPool.withClient during an RPC outage', () => {
  function makePool(poolSize = 2) {
    return new SorobanClientPool({ rpcUrl: 'http://localhost', poolSize, acquireTimeoutMs: 200 });
  }

  it('propagates the circuit error and still returns clients to the pool', async () => {
    const pool = makePool(2);
    await simulateOutage((fn) => pool.withClient(fn, 'get_group'));

    await expect(pool.withClient(async () => 'unused', 'get_group'))
      .rejects.toThrow(CircuitBreakerOpenError);

    // A fast-failed call must not leak a pooled client.
    expect(pool.metrics().available).toBe(2);
    expect(pool.metrics().inUse).toBe(0);
  });

  it('serves calls normally again once the breaker resets', async () => {
    const pool = makePool(2);
    await simulateOutage((fn) => pool.withClient(fn, 'get_group'));

    resetRpcCircuitBreakers();

    await expect(pool.withClient(async () => 'ok', 'get_group')).resolves.toBe('ok');
  });
});

// === Cached-read fallback

describe('withRpcFallback cached-read behaviour', () => {
  it('returns the live result and never consults the cache when healthy', async () => {
    const loadFromCache = jest.fn().mockResolvedValue({ stale: true });

    const result = await withRpcFallback(
      'soroban_rpc',
      async () => ({ stale: false }),
      { loadFromCache, operation: 'get_group' }
    );

    expect(result).toEqual({ stale: false });
    expect(loadFromCache).not.toHaveBeenCalled();
  });

  it('degrades to the cached value when the circuit is open', async () => {
    await simulateOutage(withSorobanCircuit);
    const loadFromCache = jest.fn().mockResolvedValue({ stale: true });
    const rpc = jest.fn().mockResolvedValue({ stale: false });

    const result = await withRpcFallback('soroban_rpc', rpc, {
      loadFromCache,
      operation: 'get_group',
    });

    expect(result).toEqual({ stale: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('degrades to the cached value when a single call fails before the circuit trips', async () => {
    const loadFromCache = jest.fn().mockResolvedValue({ stale: true });

    const result = await withRpcFallback(
      'soroban_rpc',
      async () => { throw new Error('ECONNRESET'); },
      { loadFromCache, operation: 'get_group' }
    );

    expect(result).toEqual({ stale: true });
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('returns null when the circuit is open and nothing is cached', async () => {
    await simulateOutage(withSorobanCircuit);

    const result = await withRpcFallback('soroban_rpc', async () => 'live', {
      loadFromCache: async () => null,
      operation: 'get_group',
    });

    expect(result).toBeNull();
  });

  it('returns null rather than throwing when the cache itself is unavailable', async () => {
    await simulateOutage(withSorobanCircuit);

    const result = await withRpcFallback('soroban_rpc', async () => 'live', {
      loadFromCache: async () => { throw new Error('redis down'); },
      operation: 'get_group',
    });

    expect(result).toBeNull();
  });
});
