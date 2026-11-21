import { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { WebSocketGateway } from './ws_gateway';
import { FraudDetectionWorker } from './fraud_detection_worker';
import { logger } from './logger';

/**
 * A long-lived resource that participates in graceful shutdown.
 * Resources are started in registration order and stopped in reverse order.
 */
export interface Lifecycle {
  start(): Promise<void> | void;
  stop(timeoutMs: number): Promise<void> | void;
}

interface RegisteredResource {
  name: string;
  resource: Lifecycle;
}

const DEFAULT_STOP_TIMEOUT_MS = 10_000;

/**
 * Upper bound for the entire shutdown sequence. Individual resources are
 * bounded by the per-resource timeout, but a global deadline guarantees the
 * process exits even if many resources each consume their full budget.
 */
const DEFAULT_GLOBAL_TIMEOUT_MS = 30_000;

export class ShutdownCoordinator {
  private readonly resources: RegisteredResource[] = [];
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | undefined;

  register(name: string, resource: Lifecycle): void {
    this.resources.push({ name, resource });
  }

  async startAll(): Promise<void> {
    for (const { name, resource } of this.resources) {
      try {
        await resource.start();
      } catch (err) {
        logger.error(`Failed to start resource ${name}`, err);
        throw err;
      }
    }
  }

  /**
   * Stop all registered resources in reverse start order, each bounded by
   * `timeoutMs`, and the whole sequence bounded by `globalTimeoutMs`.
   * Resources that fail to stop in time are logged. Repeated calls return the
   * same in-flight promise so shutdown runs exactly once.
   */
  shutdown(
    timeoutMs: number = DEFAULT_STOP_TIMEOUT_MS,
    globalTimeoutMs: number = DEFAULT_GLOBAL_TIMEOUT_MS,
  ): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }
    this.shuttingDown = true;
    this.shutdownPromise = this.runShutdown(timeoutMs, globalTimeoutMs);
    return this.shutdownPromise;
  }

  private async runShutdown(timeoutMs: number, globalTimeoutMs: number): Promise<void> {
    const failed: string[] = [];
    let globalTimer: NodeJS.Timeout | undefined;
    const globalDeadline = new Promise<never>((_, reject) => {
      globalTimer = setTimeout(
        () => reject(new Error(`Global shutdown timed out after ${globalTimeoutMs}ms`)),
        globalTimeoutMs,
      );
      globalTimer.unref?.();
    });

    const sequence = (async () => {
      for (let i = this.resources.length - 1; i >= 0; i--) {
        const { name, resource } = this.resources[i];
        try {
          await this.stopWithTimeout(name, resource, timeoutMs);
        } catch (err) {
          failed.push(name);
          logger.error(`Resource ${name} did not stop within ${timeoutMs}ms`, err);
        }
      }
    })();

    try {
      await Promise.race([sequence, globalDeadline]);
    } catch (err) {
      logger.error('Global shutdown deadline exceeded', err);
    } finally {
      if (globalTimer) {
        clearTimeout(globalTimer);
      }
    }

    if (failed.length > 0) {
      logger.error(`Resources that did not stop cleanly: ${failed.join(', ')}`);
    }
  }

  private async stopWithTimeout(
    name: string,
    resource: Lifecycle,
    timeoutMs: number,
  ): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out stopping ${name} after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      await Promise.race([Promise.resolve(resource.stop(timeoutMs)), timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

/**
 * Wrap an HTTP server as a Lifecycle resource.
 */
export function httpServerLifecycle(server: Server): Lifecycle {
  return {
    start: () => undefined,
    stop: (timeoutMs: number) =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          reject(new Error('HTTP server close timed out'));
        }, timeoutMs);
        timer.unref?.();

        server.close((err) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}

/**
 * Wrap a Prisma client as a Lifecycle resource.
 */
export function prismaLifecycle(prisma: PrismaClient): Lifecycle {
  return {
    start: () => undefined,
    stop: () => prisma.$disconnect(),
  };
}

/**
 * Wrap a Redis client as a Lifecycle resource.
 */
export function redisLifecycle(redis: Redis): Lifecycle {
  return {
    start: () => undefined,
    stop: () => redis.quit().then(() => undefined),
  };
}

/**
 * Wrap the WebSocket gateway as a Lifecycle resource.
 */
export function wsGatewayLifecycle(gateway: WebSocketGateway): Lifecycle {
  return {
    start: () => gateway.start(),
    stop: () => gateway.stop(),
  };
}

/**
 * Wrap a worker as a Lifecycle resource.
 */
export function workerLifecycle(worker: FraudDetectionWorker): Lifecycle {
  return {
    start: () => worker.start(),
    stop: () => worker.stop(),
  };
}

/**
 * Build the coordinator with every long-lived resource registered.
 */
export function createShutdownCoordinator(deps: {
  server: Server;
  wsGateway: WebSocketGateway;
  redis: Redis;
  prisma: PrismaClient;
  workers: FraudDetectionWorker[];
}): ShutdownCoordinator {
  const coordinator = new ShutdownCoordinator();
  coordinator.register('http-server', httpServerLifecycle(deps.server));
  coordinator.register('ws-gateway', wsGatewayLifecycle(deps.wsGateway));
  coordinator.register('redis', redisLifecycle(deps.redis));
  coordinator.register('prisma', prismaLifecycle(deps.prisma));
  deps.workers.forEach((worker, index) => {
    coordinator.register(`worker-${index}`, workerLifecycle(worker));
  });
  return coordinator;
}

let coordinator: ShutdownCoordinator | undefined;
let signalHandlersRegistered = false;

export function setShutdownCoordinator(c: ShutdownCoordinator): void {
  coordinator = c;
}

/**
 * Register SIGTERM/SIGINT handlers. Registration is idempotent: repeated calls
 * are no-ops, and repeated signals during an in-flight shutdown are ignored.
 */
export function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;

  let handling = false;
  const handle = (signal: NodeJS.Signals) => {
    if (handling) {
      logger.warn(`Received ${signal} during shutdown, ignoring`);
      return;
    }
    handling = true;
    logger.info(`Received ${signal}, starting graceful shutdown`);

    if (!coordinator) {
      logger.error('No shutdown coordinator registered');
      process.exit(1);
    }

    coordinator
      .shutdown()
      .then(() => process.exit(0))
      .catch((err) => {
        logger.error('Graceful shutdown failed', err);
        process.exit(1);
      });
  };

  process.on('SIGTERM', handle);
  process.on('SIGINT', handle);
}
