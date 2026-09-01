import { rpc as SorobanRpc } from '@stellar/stellar-sdk';

import { CircuitBreakerOpenError, CircuitState, resetRpcCircuitBreakers, sorobanCircuitBreaker } from '../../src/lib/rpc_circuit_breaker';
import { SorobanClientPool } from '../../src/lib/soroban';
import { config } from '../../src/config';

jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn().mockImplementation((url: string) => ({ url })),
  },
}));

type TestServer = SorobanRpc.Server & { url: string };

const PRIMARY = 'https://primary.staging.invalid';
const FALLBACK = 'https://fallback.staging.invalid';

function createPool(): SorobanClientPool {
  return new SorobanClientPool({
    rpcUrl: PRIMARY,
    fallbackRpcUrls: [FALLBACK],
    poolSize: 1,
  });
}

beforeEach(() => resetRpcCircuitBreakers());
afterEach(() => resetRpcCircuitBreakers());

describe('staging Soroban RPC failover chaos test', () => {
  it('fails over when the primary becomes unavailable mid-operation', async () => {
    const pool = createPool();
    const visited: string[] = [];

    const result = await pool.withClient(async (client) => {
      const endpoint = (client as TestServer).url;
      visited.push(endpoint);
      if (endpoint === PRIMARY) throw new Error('simulated staging RPC outage');
      return { endpoint, transactionStatus: 'SUCCESS' };
    }, 'send_transaction');

    expect(result).toEqual({ endpoint: FALLBACK, transactionStatus: 'SUCCESS' });
    expect(visited).toEqual([PRIMARY, FALLBACK]);
    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(pool.metrics()).toMatchObject({ available: 1, inUse: 0 });
  });

  it('opens the circuit when both primary and fallback are unavailable', async () => {
    const pool = createPool();
    const outage = jest.fn().mockRejectedValue(new Error('all staging RPC nodes unavailable'));

    for (let attempt = 0; attempt < config.rpcCircuitBreaker.volumeThreshold; attempt++) {
      await expect(pool.withClient(outage, 'send_transaction')).rejects.toThrow(
        'all staging RPC nodes unavailable',
      );
    }

    expect(sorobanCircuitBreaker.getState()).toBe(CircuitState.OPEN);
    const callsBeforeFastFailure = outage.mock.calls.length;
    await expect(pool.withClient(outage, 'send_transaction')).rejects.toThrow(
      CircuitBreakerOpenError,
    );
    expect(outage).toHaveBeenCalledTimes(callsBeforeFastFailure);
  });
});
