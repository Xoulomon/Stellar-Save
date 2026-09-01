/**
 * Standardized operational probes (Issue #1514).
 *
 * `/healthz` — liveness. Answers "is the process up?" and never touches a
 *              dependency, so a slow database can never restart the pod.
 * `/readyz`  — readiness. Verifies PostgreSQL and the Soroban RPC endpoint are
 *              reachable and returns 503 when either is down, so a broken
 *              instance is pulled out of the load-balancer rotation.
 *
 * Response shapes are documented in `openapi.yaml` under `/healthz` and
 * `/readyz`.
 */

import { Router } from 'express';

import { logger } from '../logger';

import type { Request, Response } from 'express';

// === Types

/** Result of a single dependency probe. */
export interface DependencyStatus {
  up: boolean;
  latencyMs: number;
  error?: string;
}

/** Probes injected into the router so tests can drive both healthy and unhealthy paths. */
export interface HealthCheckDeps {
  checkDatabase: () => Promise<DependencyStatus>;
  checkRpc: () => Promise<DependencyStatus>;
}

/** Body returned by `GET /healthz`. */
export interface LivenessResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

/** Body returned by `GET /readyz` (200 when ready, 503 when not). */
export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  responseTimeMs: number;
  timestamp: string;
  checks: {
    database: DependencyStatus;
    rpc: DependencyStatus;
  };
}

// === Probe factories

/**
 * Builds a database probe backed by a Prisma-like client.
 *
 * Typed structurally rather than against `PrismaClient` so the readiness route
 * stays usable with the read-replica proxy exported by `prisma_client.ts`.
 */
export function createDatabaseCheck(client: {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}): () => Promise<DependencyStatus> {
  return async (): Promise<DependencyStatus> => {
    const start = Date.now();
    try {
      await client.$queryRaw`SELECT 1`;
      return { up: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        up: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

/**
 * Builds a Soroban RPC probe using the JSON-RPC `getHealth` method.
 *
 * `getHealth` is the cheapest call the RPC server exposes and requires no
 * ledger state, which keeps the readiness probe safe to poll frequently.
 */
export function createRpcCheck(rpcUrl: string, timeoutMs: number = 3000): () => Promise<DependencyStatus> {
  return async (): Promise<DependencyStatus> => {
    const start = Date.now();
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        return {
          up: false,
          latencyMs: Date.now() - start,
          error: `RPC responded with HTTP ${res.status}`,
        };
      }

      const body = (await res.json()) as {
        result?: { status?: string };
        error?: { message?: string };
      };

      if (body.error) {
        return {
          up: false,
          latencyMs: Date.now() - start,
          error: body.error.message ?? 'RPC returned an error',
        };
      }

      if (body.result?.status !== 'healthy') {
        return {
          up: false,
          latencyMs: Date.now() - start,
          error: `RPC reported status "${body.result?.status ?? 'unknown'}"`,
        };
      }

      return { up: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        up: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

// === Router

export function createHealthRouter(deps: HealthCheckDeps): Router {
  const router = Router();
  const { checkDatabase, checkRpc } = deps;

  router.get('/healthz', (_req: Request, res: Response) => {
    const body: LivenessResponse = {
      status: 'ok',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(body);
  });

  router.get('/readyz', async (_req: Request, res: Response) => {
    const start = Date.now();

    // Probes never reject — both factories convert failures into `up: false` —
    // so Promise.all is safe and always reports on every dependency.
    const [database, rpc] = await Promise.all([checkDatabase(), checkRpc()]);

    const ready = database.up && rpc.up;

    if (!ready) {
      logger.warn('readiness probe failed', {
        database_up: database.up,
        database_error: database.error,
        rpc_up: rpc.up,
        rpc_error: rpc.error,
      });
    }

    const body: ReadinessResponse = {
      status: ready ? 'ready' : 'not_ready',
      responseTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      checks: { database, rpc },
    };

    res.status(ready ? 200 : 503).json(body);
  });

  return router;
}
