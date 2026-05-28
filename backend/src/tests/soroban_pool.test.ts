import { SorobanClientPool, getSorobanPool, resetSorobanPool } from '../lib/soroban';

// Stub SorobanRpc.Server so tests don't need a live RPC endpoint
jest.mock('@stellar/stellar-sdk', () => {
  class FakeServer {
    constructor(public url: string, _opts?: unknown) {}
  }
  return { rpc: { Server: FakeServer } };
});

function makePool(poolSize = 3, acquireTimeoutMs = 200) {
  return new SorobanClientPool({ rpcUrl: 'http://localhost', poolSize, acquireTimeoutMs });
}

describe('SorobanClientPool', () => {
  describe('metrics', () => {
    it('reports correct initial state', () => {
      const pool = makePool(3);
      const m = pool.metrics();
      expect(m.total).toBe(3);
      expect(m.available).toBe(3);
      expect(m.inUse).toBe(0);
      expect(m.acquireTimeouts).toBe(0);
      expect(m.utilizationPct).toBe(0);
    });
  });

  describe('acquire / release', () => {
    it('decrements available and increments inUse on acquire', async () => {
      const pool = makePool(2);
      const client = await pool.acquire();
      const m = pool.metrics();
      expect(m.available).toBe(1);
      expect(m.inUse).toBe(1);
      pool.release(client);
    });

    it('restores available after release', async () => {
      const pool = makePool(2);
      const client = await pool.acquire();
      pool.release(client);
      const m = pool.metrics();
      expect(m.available).toBe(2);
      expect(m.inUse).toBe(0);
    });

    it('queues waiters when pool is exhausted and resolves on release', async () => {
      const pool = makePool(1);
      const c1 = await pool.acquire();

      // Second acquire should queue
      let c2Resolved = false;
      const p2 = pool.acquire().then(c => { c2Resolved = true; return c; });

      expect(c2Resolved).toBe(false);
      pool.release(c1);

      const c2 = await p2;
      expect(c2Resolved).toBe(true);
      pool.release(c2);
    });

    it('rejects with timeout when pool stays exhausted', async () => {
      const pool = makePool(1, 50);
      const c1 = await pool.acquire();

      await expect(pool.acquire()).rejects.toThrow('timed out');
      expect(pool.metrics().acquireTimeouts).toBe(1);

      pool.release(c1);
    });
  });

  describe('withClient', () => {
    it('runs the callback and releases the client', async () => {
      const pool = makePool(1);
      const result = await pool.withClient(async () => 42);
      expect(result).toBe(42);
      expect(pool.metrics().available).toBe(1);
      expect(pool.metrics().inUse).toBe(0);
    });

    it('releases the client even when the callback throws', async () => {
      const pool = makePool(1);
      await expect(pool.withClient(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
      expect(pool.metrics().available).toBe(1);
    });
  });

  describe('utilizationPct', () => {
    it('reflects percentage of clients in use', async () => {
      const pool = makePool(4);
      const c1 = await pool.acquire();
      const c2 = await pool.acquire();
      expect(pool.metrics().utilizationPct).toBe(50);
      pool.release(c1);
      pool.release(c2);
    });
  });

  describe('getSorobanPool singleton', () => {
    beforeEach(() => resetSorobanPool());
    afterEach(() => resetSorobanPool());

    it('returns the same instance on repeated calls', () => {
      const a = getSorobanPool();
      const b = getSorobanPool();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after reset', () => {
      const a = getSorobanPool();
      resetSorobanPool();
      const b = getSorobanPool();
      expect(a).not.toBe(b);
    });
  });
});
