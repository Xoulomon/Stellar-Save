/**
 * Integration coverage for the standardized operational probes (Issue #1514).
 *
 * The database probe runs against the real test Postgres instance brought up by
 * `test/docker-compose.test.yml`. The RPC probe is driven against a throwaway
 * HTTP server started in-process, which lets the unhealthy path be exercised
 * without any network flakiness.
 */

import express, { Express } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';

import { PrismaClient } from '../../src/generated/prisma/client';
import { createHealthRouter, createDatabaseCheck, createRpcCheck } from '../../src/routes/health';

// === Fake Soroban RPC

type RpcMode = 'healthy' | 'unhealthy' | 'error';

interface FakeRpc {
  url: string;
  setMode: (mode: RpcMode) => void;
  close: () => Promise<void>;
}

async function startFakeRpc(): Promise<FakeRpc> {
  let mode: RpcMode = 'healthy';

  const server = http.createServer((req, res) => {
    if (mode === 'error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
      return;
    }

    const body =
      mode === 'healthy'
        ? { jsonrpc: '2.0', id: 1, result: { status: 'healthy' } }
        : { jsonrpc: '2.0', id: 1, result: { status: 'unhealthy' } };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    setMode: (next: RpcMode) => {
      mode = next;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// === Suite

describe('Operational probes', () => {
  const prisma = new PrismaClient();
  let rpc: FakeRpc;

  // A URL on a closed port: connection is refused immediately, which is the
  // cheapest way to simulate an unreachable dependency.
  const UNREACHABLE_URL = 'http://127.0.0.1:1';

  function buildApp(rpcUrl: string, dbClient: PrismaClient): Express {
    const app = express();
    app.use(express.json());
    app.use(
      createHealthRouter({
        checkDatabase: createDatabaseCheck(dbClient),
        checkRpc: createRpcCheck(rpcUrl, 2000),
      }),
    );
    return app;
  }

  beforeAll(async () => {
    rpc = await startFakeRpc();
  });

  afterAll(async () => {
    await rpc.close();
    await prisma.$disconnect();
  });

  describe('GET /healthz', () => {
    it('returns 200 without touching any dependency', async () => {
      // Both dependencies are unreachable — liveness must still be 200.
      const app = buildApp(UNREACHABLE_URL, prisma);

      const res = await request(app).get('/healthz');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.uptimeSeconds).toBeGreaterThan(0);
      expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('GET /readyz — healthy', () => {
    it('returns 200 ready when the database and RPC are both reachable', async () => {
      rpc.setMode('healthy');
      const app = buildApp(rpc.url, prisma);

      const res = await request(app).get('/readyz');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database.up).toBe(true);
      expect(res.body.checks.rpc.up).toBe(true);
      expect(res.body.checks.database.error).toBeUndefined();
      expect(res.body.checks.rpc.error).toBeUndefined();
      expect(typeof res.body.responseTimeMs).toBe('number');
    });
  });

  describe('GET /readyz — unhealthy', () => {
    it('returns 503 not_ready when the database is unreachable', async () => {
      rpc.setMode('healthy');
      const brokenDb = new PrismaClient({
        datasources: { db: { url: 'postgresql://nobody:nobody@127.0.0.1:1/nonexistent' } },
      });
      const app = buildApp(rpc.url, brokenDb);

      const res = await request(app).get('/readyz');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.database.up).toBe(false);
      expect(typeof res.body.checks.database.error).toBe('string');
      expect(res.body.checks.rpc.up).toBe(true);

      await brokenDb.$disconnect();
    });

    it('returns 503 not_ready when the RPC endpoint is unreachable', async () => {
      const app = buildApp(UNREACHABLE_URL, prisma);

      const res = await request(app).get('/readyz');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.rpc.up).toBe(false);
      expect(typeof res.body.checks.rpc.error).toBe('string');
      expect(res.body.checks.database.up).toBe(true);
    });

    it('returns 503 not_ready when the RPC responds with a non-2xx status', async () => {
      rpc.setMode('error');
      const app = buildApp(rpc.url, prisma);

      const res = await request(app).get('/readyz');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.rpc.up).toBe(false);
      expect(res.body.checks.rpc.error).toContain('HTTP 500');
    });

    it('returns 503 not_ready when the RPC reports a non-healthy status', async () => {
      rpc.setMode('unhealthy');
      const app = buildApp(rpc.url, prisma);

      const res = await request(app).get('/readyz');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.rpc.up).toBe(false);
      expect(res.body.checks.rpc.error).toContain('unhealthy');
    });
  });
});
