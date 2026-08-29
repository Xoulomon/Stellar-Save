/**
 * Circuit breakers for the two external Stellar RPC dependencies (Issue #1511).
 *
 * Both Soroban RPC and Horizon are third-party endpoints outside our failure
 * domain. Without breaking the circuit, a degraded endpoint turns every request
 * into a full timeout, which holds request handlers, worker slots and pooled
 * clients open until the whole backend stalls. Failing fast keeps the outage
 * local to the feature that needs the chain.
 *
 * Wiring points:
 *  - `SorobanClientPool.withClient` (lib/soroban.ts) — every Soroban RPC call.
 *  - `ContractEventIndexer` (contract_event_indexer.ts) — Horizon poll + readiness.
 */

import { CircuitBreaker, CircuitBreakerOpenError, CircuitState } from './circuit_breaker';
import {
  circuitBreakerState,
  circuitBreakerTripsTotal,
  circuitBreakerFallbacksTotal,
} from '../metrics';
import { config } from '../config';
import { logger } from '../logger';

export { CircuitBreakerOpenError, CircuitState };

// === Types

export type RpcBreakerName = 'soroban_rpc' | 'horizon';

export interface RpcFallbackOptions<T> {
  /** Cached-read supplier used when the circuit is open or the call fails. */
  loadFromCache: () => Promise<T | null>;
  /** Label for metrics / logs, e.g. `get_group`. */
  operation: string;
}

// === Metrics wiring

const STATE_VALUE: Record<CircuitState, number> = {
  [CircuitState.CLOSED]: 0,
  [CircuitState.HALF_OPEN]: 1,
  [CircuitState.OPEN]: 2,
};

function onStateChange(name: string, from: CircuitState, to: CircuitState): void {
  circuitBreakerState.set({ breaker: name }, STATE_VALUE[to]);
  if (to === CircuitState.OPEN) {
    circuitBreakerTripsTotal.inc({ breaker: name });
    logger.error(`[circuit] ${name} tripped OPEN (was ${from}) — failing fast`);
  } else {
    logger.warn(`[circuit] ${name} ${from} -> ${to}`);
  }
}

// === Breakers

/**
 * A breaker over a thunk rather than a fixed function, so a single breaker
 * instance can guard every call site for that dependency. This mirrors the
 * existing `fiatRampCircuitBreaker` in services/sep24.ts.
 */
function makeRpcBreaker(name: RpcBreakerName): CircuitBreaker<[() => Promise<any>], any> {
  circuitBreakerState.set({ breaker: name }, STATE_VALUE[CircuitState.CLOSED]);
  return new CircuitBreaker(
    async <T>(fn: () => Promise<T>): Promise<T> => fn(),
    {
      name,
      timeout: config.rpcCircuitBreaker.timeoutMs,
      errorThresholdPercentage: config.rpcCircuitBreaker.errorThresholdPercentage,
      resetTimeout: config.rpcCircuitBreaker.resetTimeoutMs,
      volumeThreshold: config.rpcCircuitBreaker.volumeThreshold,
      onStateChange,
    }
  );
}

export const sorobanCircuitBreaker = makeRpcBreaker('soroban_rpc');
export const horizonCircuitBreaker = makeRpcBreaker('horizon');

const BREAKERS: Record<RpcBreakerName, CircuitBreaker<[() => Promise<any>], any>> = {
  soroban_rpc: sorobanCircuitBreaker,
  horizon: horizonCircuitBreaker,
};

// === Public API

/** Run `fn` through the Soroban RPC breaker. Throws CircuitBreakerOpenError when open. */
export function withSorobanCircuit<T>(fn: () => Promise<T>): Promise<T> {
  return sorobanCircuitBreaker.fire(fn) as Promise<T>;
}

/** Run `fn` through the Horizon breaker. Throws CircuitBreakerOpenError when open. */
export function withHorizonCircuit<T>(fn: () => Promise<T>): Promise<T> {
  return horizonCircuitBreaker.fire(fn) as Promise<T>;
}

export function isCircuitOpenError(err: unknown): boolean {
  return (
    err instanceof CircuitBreakerOpenError ||
    (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'CIRCUIT_OPEN')
  );
}

/**
 * Run `fn` through `breaker`, degrading to a cached read instead of throwing.
 *
 * Returns `null` when the circuit is open (or the call failed) and no cached
 * value is available — callers treat that the same as "unknown", which is the
 * only honest answer during an upstream outage.
 */
export async function withRpcFallback<T>(
  breaker: RpcBreakerName,
  fn: () => Promise<T>,
  opts: RpcFallbackOptions<T>
): Promise<T | null> {
  try {
    return (await BREAKERS[breaker].fire(fn)) as T;
  } catch (err) {
    const reason = isCircuitOpenError(err) ? 'circuit_open' : 'call_failed';
    const cached = await opts.loadFromCache().catch(() => null);
    circuitBreakerFallbacksTotal.inc({
      breaker,
      outcome: cached === null ? `${reason}_miss` : `${reason}_hit`,
    });
    logger.warn(
      `[circuit] ${breaker} fallback for ${opts.operation}: ${reason}, cache ${cached === null ? 'miss' : 'hit'}`
    );
    return cached;
  }
}

/** Reset both breakers to CLOSED. Test-only helper. */
export function resetRpcCircuitBreakers(): void {
  sorobanCircuitBreaker.reset();
  horizonCircuitBreaker.reset();
}
