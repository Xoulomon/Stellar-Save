import { config } from './config';
import { logger } from './utils/logger';
import {
  ShutdownCoordinator,
  registerSignalHandlers,
  type ShutdownHook,
} from './graceful_shutdown';

const PORT = config.port;

/**
 * Builds the list of shutdown hooks for the backend service.
 * Hooks are executed in reverse registration order by the coordinator.
 */
export function buildShutdownHooks(): ShutdownHook[] {
  return [
    {
      name: 'http-server',
      handler: async () => {
        logger.info('closing http server');
      },
    },
    {
      name: 'database',
      handler: async () => {
        logger.info('closing database connections');
      },
    },
  ];
}

/**
 * Starts the backend service.
 * Throws on bootstrap failure so the caller can exit cleanly.
 */
export async function start(
  coordinator: ShutdownCoordinator = new ShutdownCoordinator(),
): Promise<ShutdownCoordinator> {
  logger.info('backend service starting', { port: PORT });

  // ...existing service bootstrap logic...

  for (const hook of buildShutdownHooks()) {
    coordinator.register(hook);
  }

  logger.info('backend service started', { port: PORT });

  return coordinator;
}

/**
 * Wires up startup and graceful shutdown. Exposed for unit testing.
 */
export async function bootstrap(): Promise<void> {
  const coordinator = new ShutdownCoordinator();

  registerSignalHandlers(coordinator, {
    onError: (error: unknown) => {
      logger.error('graceful shutdown failed', { error });
    },
  });

  try {
    await start(coordinator);
  } catch (error: unknown) {
    logger.error('backend service failed to start', { error });
    // Ensure any partially-initialized resources are released.
    await coordinator.shutdown('startup-failure').catch((shutdownError: unknown) => {
      logger.error('cleanup after startup failure failed', { error: shutdownError });
    });
    process.exit(1);
  }
}

// Only auto-bootstrap when run directly, not when imported by tests.
if (require.main === module) {
  void bootstrap();
}