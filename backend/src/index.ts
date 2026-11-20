import { config } from './config';
import { logger } from './lib/logger';
import { requestId } from './middleware/requestId';
import { errorMiddleware, notFoundMiddleware } from './middleware/error';
import { bootstrapKeys } from './key_rotation_service';

const PORT = config.port;

async function start(): Promise<void> {
  logger.info('backend service starting', { port: PORT });

  await bootstrapKeys();

  // ...existing service bootstrap logic...

  logger.info('backend service started', { port: PORT });
}

start().catch((error: unknown) => {
  logger.error('backend service failed to start', { error });
  process.exit(1);
});

export { start, requestId, errorMiddleware, notFoundMiddleware };